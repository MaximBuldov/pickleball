<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Db;
use App\HttpError;
use App\Input;
use App\Matches;
use App\Roulette;
use App\Stats;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** A game day: who came, the current roulette pairs and that day's matches. */
final class DaysController extends Controller
{
    public function get(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireMember($this->db, $request, $groupId);
        return $this->json($response, $this->dayPayload($groupId, Input::date($args['date'])));
    }

    public function setPlayers(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $date = Input::date($args['date']);
        Auth::requireMember($this->db, $request, $groupId);
        $userIds = array_values(array_unique(Input::intList(Input::body($request), 'player_ids')));
        $matches = new Matches($this->db);
        $matches->assertMembers($groupId, $userIds);

        $this->db->transaction(function () use ($matches, $groupId, $date, $userIds, $request) {
            $day = $matches->getOrCreateGameDay($groupId, $date, (int) Auth::user($request)['id']);
            $this->db->exec('DELETE FROM game_day_players WHERE game_day_id = ?', [$day['id']]);
            $matches->addAttendees((int) $day['id'], $userIds);
        });
        return $this->json($response, $this->dayPayload($groupId, $date));
    }

    public function roulette(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $date = Input::date($args['date']);
        Auth::requireMember($this->db, $request, $groupId);
        $matches = new Matches($this->db);
        $day = $matches->gameDay($groupId, $date);
        $players = $day ? $this->attendeeIds((int) $day['id']) : [];
        if (count($players) < 4) {
            throw HttpError::badRequest('Select at least 4 players first');
        }

        $previous = $this->latestRound((int) $day['id']);
        $pairs = Roulette::generate($players, Stats::partnerCounts($matches->rows($groupId)), $previous['pairs'] ?? []);
        $this->saveRound((int) $day['id'], $pairs, false, (int) Auth::user($request)['id']);
        return $this->json($response, $this->dayPayload($groupId, $date));
    }

    /** Manually set pairs, e.g. after fixing the roulette result by hand. */
    public function setPairs(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $date = Input::date($args['date']);
        Auth::requireMember($this->db, $request, $groupId);
        $pairsIn = Input::body($request)['pairs'] ?? null;
        if (!is_array($pairsIn)) {
            throw HttpError::badRequest('Field "pairs" must be a list');
        }
        $pairs = [];
        $seen = [];
        foreach ($pairsIn as $pair) {
            if (!is_array($pair) || count($pair) < 1 || count($pair) > 2) {
                throw HttpError::badRequest('Each pair must have one or two players');
            }
            $pair = Input::intList(['p' => $pair], 'p');
            foreach ($pair as $id) {
                if (isset($seen[$id])) {
                    throw HttpError::badRequest('A player can only be in one pair');
                }
                $seen[$id] = true;
            }
            sort($pair);
            $pairs[] = $pair;
        }

        $matches = new Matches($this->db);
        $matches->assertMembers($groupId, array_keys($seen));
        $this->db->transaction(function () use ($matches, $groupId, $date, $pairs, $seen, $request) {
            $userId = (int) Auth::user($request)['id'];
            $day = $matches->getOrCreateGameDay($groupId, $date, $userId);
            $matches->addAttendees((int) $day['id'], array_keys($seen));
            $this->saveRound((int) $day['id'], $pairs, true, $userId);
        });
        return $this->json($response, $this->dayPayload($groupId, $date));
    }

    private function dayPayload(int $groupId, string $date): array
    {
        $matches = new Matches($this->db);
        $day = $matches->gameDay($groupId, $date);
        if ($day === null) {
            return ['date' => $date, 'player_ids' => [], 'pairs' => [], 'pairs_manual' => false, 'matches' => []];
        }
        $round = $this->latestRound((int) $day['id']);
        $playerIds = $this->attendeeIds((int) $day['id']);
        // Players removed from the group since the round was drawn drop out of its pairs.
        $members = array_flip(array_map('intval', array_column(
            $this->db->all('SELECT user_id FROM group_members WHERE group_id = ?', [$groupId]),
            'user_id',
        )));
        $pairs = array_values(array_filter(array_map(
            fn ($pair) => array_values(array_filter($pair, fn ($id) => isset($members[$id]))),
            $round['pairs'] ?? [],
        )));
        return [
            'date' => $date,
            'player_ids' => $playerIds,
            'pairs' => $pairs,
            'pairs_manual' => $round['is_manual'] ?? false,
            'matches' => $matches->format($matches->rows($groupId, gameDayId: (int) $day['id'])),
        ];
    }

    /** Attendees who are still members of the day's group. */
    private function attendeeIds(int $gameDayId): array
    {
        return array_map('intval', array_column(
            $this->db->all(
                'SELECT p.user_id FROM game_day_players p
                 JOIN game_days d ON d.id = p.game_day_id
                 JOIN group_members gm ON gm.group_id = d.group_id AND gm.user_id = p.user_id
                 WHERE p.game_day_id = ? ORDER BY p.user_id',
                [$gameDayId],
            ),
            'user_id',
        ));
    }

    private function latestRound(int $gameDayId): ?array
    {
        $row = $this->db->one('SELECT pairs, is_manual FROM roulette_rounds WHERE game_day_id = ? ORDER BY id DESC LIMIT 1', [$gameDayId]);
        return $row === null ? null : ['pairs' => json_decode($row['pairs'], true), 'is_manual' => (bool) $row['is_manual']];
    }

    private function saveRound(int $gameDayId, array $pairs, bool $manual, int $userId): void
    {
        $this->db->insert('roulette_rounds', [
            'game_day_id' => $gameDayId,
            'pairs' => json_encode($pairs),
            'is_manual' => $manual ? 1 : 0,
            'created_by' => $userId,
            'created_at' => Db::now(),
        ]);
    }
}
