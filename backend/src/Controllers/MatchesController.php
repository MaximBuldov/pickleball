<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Db;
use App\HttpError;
use App\Input;
use App\Matches;
use App\Score;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Any member can record a match; only admins can edit or delete one (every change is logged). */
final class MatchesController extends Controller
{
    public function list(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireMember($this->db, $request, $groupId);
        $query = $request->getQueryParams();
        $matches = new Matches($this->db);
        $rows = $matches->rows($groupId, Input::optionalDate($query, 'from'), Input::optionalDate($query, 'to'));
        return $this->json($response, $matches->format($rows));
    }

    public function create(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireMember($this->db, $request, $groupId);
        $body = Input::body($request);
        $date = Input::date($body['date'] ?? null);
        $fields = $this->validated($groupId, $body);
        $matches = new Matches($this->db);
        $userId = (int) Auth::user($request)['id'];

        $id = $this->db->transaction(function () use ($matches, $groupId, $date, $fields, $userId) {
            $day = $matches->getOrCreateGameDay($groupId, $date, $userId);
            $matches->addAttendees((int) $day['id'], [$fields['a1'], $fields['a2'], $fields['b1'], $fields['b2']]);
            return $this->db->insert('matches', $fields + [
                'group_id' => $groupId,
                'game_day_id' => $day['id'],
                'created_by' => $userId,
                'created_at' => Db::now(),
            ]);
        });
        return $this->json($response, $matches->format([$matches->find($groupId, $id)])[0], 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireAdmin($this->db, $request, $groupId);
        $matches = new Matches($this->db);
        $before = $matches->find($groupId, (int) $args['id']);
        $fields = $this->validated($groupId, Input::body($request), (int) $before['court']);
        $userId = (int) Auth::user($request)['id'];

        $this->db->transaction(function () use ($matches, $before, $fields, $userId, $groupId) {
            $now = Db::now();
            $sets = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($fields)));
            $this->db->exec("UPDATE matches SET $sets, edited_at = :edited_at WHERE id = :id", $fields + ['edited_at' => $now, 'id' => $before['id']]);
            $after = $matches->find($groupId, (int) $before['id']);
            $this->logEdit($matches, 'edit', $before, $after, $userId, $now);
        });
        return $this->json($response, $matches->format([$matches->find($groupId, (int) $before['id'])])[0]);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireAdmin($this->db, $request, $groupId);
        $matches = new Matches($this->db);
        $before = $matches->find($groupId, (int) $args['id']);
        $this->db->transaction(function () use ($matches, $before, $request) {
            $now = Db::now();
            $this->db->exec('UPDATE matches SET deleted_at = ? WHERE id = ?', [$now, $before['id']]);
            $this->logEdit($matches, 'delete', $before, null, (int) Auth::user($request)['id'], $now);
        });
        return $this->json($response, ['ok' => true]);
    }

    public function edits(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireMember($this->db, $request, $groupId);
        $matches = new Matches($this->db);
        $match = $matches->find($groupId, (int) $args['id']);
        $rows = $this->db->all(
            'SELECT e.action, e.before_json, e.after_json, e.edited_at, u.name AS edited_by
             FROM match_edits e JOIN users u ON u.id = e.edited_by WHERE e.match_id = ? ORDER BY e.id DESC',
            [$match['id']],
        );
        return $this->json($response, array_map(fn ($r) => [
            'action' => $r['action'],
            'edited_at' => $r['edited_at'],
            'edited_by' => $r['edited_by'],
            'before' => json_decode($r['before_json'], true),
            'after' => $r['after_json'] === null ? null : json_decode($r['after_json'], true),
        ], $rows));
    }

    /** Validates teams + score and returns columns ready for the matches table. */
    private function validated(int $groupId, array $body, int $defaultCourt = 1): array
    {
        $teamA = Input::intList($body, 'team_a');
        $teamB = Input::intList($body, 'team_b');
        if (count($teamA) !== 2 || count($teamB) !== 2) {
            throw HttpError::badRequest('Each team must have exactly two players');
        }
        $all = [...$teamA, ...$teamB];
        if (count(array_unique($all)) !== 4) {
            throw HttpError::badRequest('All four players must be different');
        }
        (new Matches($this->db))->assertMembers($groupId, $all);

        $scoreA = Input::int($body, 'score_a');
        $scoreB = Input::int($body, 'score_b');
        if (($error = Score::validate($scoreA, $scoreB)) !== null) {
            throw HttpError::badRequest($error);
        }
        $court = isset($body['court']) ? Input::int($body, 'court') : $defaultCourt;
        if ($court < 1) {
            throw HttpError::badRequest('Court must be 1 or higher');
        }

        sort($teamA);
        sort($teamB);
        return [
            'court' => $court,
            'a1' => $teamA[0],
            'a2' => $teamA[1],
            'b1' => $teamB[0],
            'b2' => $teamB[1],
            'score_a' => $scoreA,
            'score_b' => $scoreB,
        ];
    }

    private function logEdit(Matches $matches, string $action, array $before, ?array $after, int $userId, string $now): void
    {
        $ids = [$before['a1'], $before['a2'], $before['b1'], $before['b2']];
        if ($after !== null) {
            array_push($ids, $after['a1'], $after['a2'], $after['b1'], $after['b2']);
        }
        $names = $matches->names($ids);
        $this->db->insert('match_edits', [
            'match_id' => $before['id'],
            'action' => $action,
            'before_json' => json_encode(Matches::snapshot($before, $names), JSON_UNESCAPED_UNICODE),
            'after_json' => $after === null ? null : json_encode(Matches::snapshot($after, $names), JSON_UNESCAPED_UNICODE),
            'edited_by' => $userId,
            'edited_at' => $now,
        ]);
    }
}
