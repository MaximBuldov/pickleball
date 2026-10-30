<?php

declare(strict_types=1);

namespace App;

/**
 * Aggregates match rows (a1, a2, b1, b2, score_a, score_b) into per-pair and per-player tables.
 */
final class Stats
{
    /** @return array<string, array> keyed by pair key, each with player_ids and totals */
    public static function pairs(array $matches): array
    {
        $rows = [];
        foreach ($matches as $m) {
            foreach (self::sides($m) as [$players, $for, $against]) {
                $key = Roulette::key($players[0], $players[1]);
                $rows[$key] ??= ['player_ids' => [min($players), max($players)]] + self::empty();
                self::add($rows[$key], $for, $against);
            }
        }
        return $rows;
    }

    /** @return array<int, array> keyed by player id */
    public static function players(array $matches): array
    {
        $rows = [];
        foreach ($matches as $m) {
            foreach (self::sides($m) as [$players, $for, $against]) {
                foreach ($players as $id) {
                    $rows[$id] ??= ['player_id' => $id] + self::empty();
                    self::add($rows[$id], $for, $against);
                }
            }
        }
        return $rows;
    }

    /** Times each pair has partnered, keyed by Roulette::key(). */
    public static function partnerCounts(array $matches): array
    {
        $counts = [];
        foreach ($matches as $m) {
            foreach ([[(int) $m['a1'], (int) $m['a2']], [(int) $m['b1'], (int) $m['b2']]] as [$x, $y]) {
                $key = Roulette::key($x, $y);
                $counts[$key] = ($counts[$key] ?? 0) + 1;
            }
        }
        return $counts;
    }

    private static function sides(array $m): array
    {
        $a = (int) $m['score_a'];
        $b = (int) $m['score_b'];
        return [
            [[(int) $m['a1'], (int) $m['a2']], $a, $b],
            [[(int) $m['b1'], (int) $m['b2']], $b, $a],
        ];
    }

    private static function empty(): array
    {
        return ['games' => 0, 'wins' => 0, 'losses' => 0, 'points_for' => 0, 'points_against' => 0];
    }

    private static function add(array &$row, int $for, int $against): void
    {
        $row['games']++;
        $row[$for > $against ? 'wins' : 'losses']++;
        $row['points_for'] += $for;
        $row['points_against'] += $against;
    }
}
