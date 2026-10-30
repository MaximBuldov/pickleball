<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Input;
use App\Matches;
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
        return $this->json($response, array_values(array_map(fn ($s) => [
            'player' => ['id' => $s['player_id'], 'name' => $names[$s['player_id']] ?? 'Unknown'],
        ] + self::totals($s), $stats)));
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
