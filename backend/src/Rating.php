<?php

declare(strict_types=1);

namespace App;

/**
 * Elo for doubles. A team's strength is the average of its players' ratings; after each match
 * every player on a team moves by K * (result - expected), so beating a stronger team (or winning
 * with a weaker partner) earns more than beating a weaker one.
 */
final class Rating
{
    public const START = 1000;
    private const K = 32;

    /**
     * @param array $matches rows with play_date, id, a1, a2, b1, b2, score_a, score_b (any order)
     * @return array{current: array<int, float>, byDay: array<int, array<string, float>>}
     *         current rating per player, and each player's rating at the end of every day they played
     */
    public static function compute(array $matches): array
    {
        usort($matches, fn ($x, $y) => [$x['play_date'], (int) $x['id']] <=> [$y['play_date'], (int) $y['id']]);

        $rating = [];
        $byDay = [];
        foreach ($matches as $m) {
            $a = [(int) $m['a1'], (int) $m['a2']];
            $b = [(int) $m['b1'], (int) $m['b2']];
            $ra = self::team($rating, $a);
            $rb = self::team($rating, $b);
            $expectedA = 1 / (1 + 10 ** (($rb - $ra) / 400));
            $resultA = (int) $m['score_a'] > (int) $m['score_b'] ? 1 : 0;
            $delta = self::K * ($resultA - $expectedA);

            foreach ($a as $id) {
                $rating[$id] = ($rating[$id] ?? self::START) + $delta;
                $byDay[$id][$m['play_date']] = $rating[$id];
            }
            foreach ($b as $id) {
                $rating[$id] = ($rating[$id] ?? self::START) - $delta;
                $byDay[$id][$m['play_date']] = $rating[$id];
            }
        }
        return ['current' => $rating, 'byDay' => $byDay];
    }

    private static function team(array $rating, array $players): float
    {
        return (($rating[$players[0]] ?? self::START) + ($rating[$players[1]] ?? self::START)) / 2;
    }
}
