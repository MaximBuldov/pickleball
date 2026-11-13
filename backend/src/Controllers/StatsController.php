<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Input;
use App\HttpError;
use App\Matches;
use App\Rating;
use App\Stats;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class StatsController extends Controller
{
    public function pairs(Request $request, Response $response, array $args): Response
    {
        [$matches, $rows] = $this->matchRows($request, (int) $args['gid']);
        $stats = Stats::pairs($rows);
        $names = $matches->names(array_merge([], ...array_column($stats, 'player_ids')));
        return $this->json($response, array_values(array_map(fn ($s) => [
            'players' => array_map(fn ($id) => ['id' => $id, 'name' => $names[$id] ?? 'Unknown'], $s['player_ids']),
        ] + self::totals($s), $stats)));
    }

    public function players(Request $request, Response $response, array $args): Response
    {
        [$matches, $rows] = $this->matchRows($request, (int) $args['gid']);
        $stats = Stats::players($rows);
        $names = $matches->names(array_keys($stats));
        // Rating is always all-time: it only means something over the full match history.
        $ratings = Rating::compute($matches->rows((int) $args['gid']))['current'];
        return $this->json($response, array_values(array_map(fn ($s) => [
            'player' => ['id' => $s['player_id'], 'name' => $names[$s['player_id']] ?? 'Unknown'],
            'rating' => (int) round($ratings[$s['player_id']] ?? Rating::START),
        ] + self::totals($s), $stats)));
    }

    /** One player's progress: per-day series, rating history and how much they lift their partners. */
    public function player(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $playerId = (int) $args['uid'];
        [$matches, $rows] = $this->matchRows($request, $groupId);
        $name = $matches->names([$playerId])[$playerId] ?? throw HttpError::notFound('Player not found');

        $rating = Rating::compute($matches->rows($groupId));
        $history = $rating['byDay'][$playerId] ?? [];
        $query = $request->getQueryParams();
        $from = Input::optionalDate($query, 'from');
        $to = Input::optionalDate($query, 'to');

        $mine = array_filter($rows, fn ($m) => in_array($playerId, [(int) $m['a1'], (int) $m['a2'], (int) $m['b1'], (int) $m['b2']], true));
        $days = [];
        foreach (array_reverse($mine) as $m) {
            $onA = in_array($playerId, [(int) $m['a1'], (int) $m['a2']], true);
            $for = (int) ($onA ? $m['score_a'] : $m['score_b']);
            $against = (int) ($onA ? $m['score_b'] : $m['score_a']);
            $date = $m['play_date'];
            $days[$date] ??= ['date' => $date, 'games' => 0, 'wins' => 0, 'points_for' => 0, 'points_against' => 0];
            $days[$date]['games']++;
            $days[$date]['wins'] += $for > $against ? 1 : 0;
            $days[$date]['points_for'] += $for;
            $days[$date]['points_against'] += $against;
        }
        ksort($days);
        foreach ($days as $date => &$day) {
            $day['rating'] = (int) round($history[$date]);
        }
        unset($day);

        // Rating before the range starts, so the client can show the change over the period.
        $before = Rating::START;
        foreach ($history as $date => $value) {
            if ($from !== null && $date < $from) {
                $before = $value;
            }
        }
        $endOfRange = Rating::START;
        foreach ($history as $date => $value) {
            if ($to === null || $date <= $to) {
                $endOfRange = $value;
            }
        }

        return $this->json($response, [
            'player' => ['id' => $playerId, 'name' => $name],
            'rating' => (int) round($endOfRange),
            'rating_change' => (int) round($endOfRange - $before),
            'totals' => self::totals(Stats::players($mine)[$playerId] ?? ['games' => 0, 'wins' => 0, 'losses' => 0, 'points_for' => 0, 'points_against' => 0]),
            'partner_effect' => self::partnerEffect($playerId, $rows),
            'days' => array_values($days),
        ]);
    }

    /**
     * Compares how often partners win with the player against their win rate in games without them.
     * Each of the player's games counts once, weighted by that partner's baseline.
     */
    private static function partnerEffect(int $playerId, array $rows): ?array
    {
        $involves = fn ($m) => in_array($playerId, [(int) $m['a1'], (int) $m['a2'], (int) $m['b1'], (int) $m['b2']], true);
        $without = Stats::players(array_filter($rows, fn ($m) => !$involves($m)));

        $games = 0;
        $wins = 0;
        $baseline = 0.0;
        foreach (array_filter($rows, $involves) as $m) {
            $onA = in_array($playerId, [(int) $m['a1'], (int) $m['a2']], true);
            $team = $onA ? [(int) $m['a1'], (int) $m['a2']] : [(int) $m['b1'], (int) $m['b2']];
            $partner = $team[0] === $playerId ? $team[1] : $team[0];
            if (empty($without[$partner]['games'])) {
                continue;
            }
            $games++;
            $wins += ((int) $m['score_a'] > (int) $m['score_b']) === $onA ? 1 : 0;
            $baseline += $without[$partner]['wins'] / $without[$partner]['games'];
        }
        return $games === 0 ? null : [
            'games' => $games,
            'with_rate' => $wins / $games,
            'without_rate' => $baseline / $games,
        ];
    }

    /** @return array{Matches, array} */
    private function matchRows(Request $request, int $groupId): array
    {
        Auth::requireMember($this->db, $request, $groupId);
        $query = $request->getQueryParams();
        $matches = new Matches($this->db);
        return [$matches, $matches->rows($groupId, Input::optionalDate($query, 'from'), Input::optionalDate($query, 'to'))];
    }

    private static function totals(array $s): array
    {
        return [
            'games' => $s['games'],
            'wins' => $s['wins'],
            'losses' => $s['losses'],
            'points_for' => $s['points_for'],
            'points_against' => $s['points_against'],
        ];
    }
}
