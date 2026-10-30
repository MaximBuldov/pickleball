<?php

declare(strict_types=1);

namespace App;

/**
 * Splits players into pairs so that partners who have played together least often are paired up.
 *
 * Cost of a split = sum over its pairs of (times the pair has partnered + penalty if the pair is in the
 * previous round). Small groups are searched exhaustively; ties are broken uniformly at random.
 */
final class Roulette
{
    private const EXHAUSTIVE_LIMIT = 12;
    private const SAMPLES = 5000;
    private const REPEAT_PENALTY = 1.5;

    /** @var array<string, float> */
    private array $pairCost = [];
    private ?array $best = null;
    private float $bestCost = INF;
    private int $ties = 0;
    /** @var callable(int, int): int */
    private $rand;

    /**
     * @param int[] $players
     * @param array<string, int> $partnerCounts keyed by Roulette::key()
     * @param int[][] $previousPairs pairs of the previous round, to avoid repeating them
     * @return int[][] sorted pairs; with an odd count the last element is a single unpaired player
     */
    public static function generate(array $players, array $partnerCounts, array $previousPairs = [], ?callable $rand = null): array
    {
        $self = new self();
        $self->rand = $rand ?? random_int(...);

        $players = array_values(array_unique($players));
        $previous = [];
        foreach ($previousPairs as $pair) {
            if (count($pair) === 2) {
                $previous[self::key($pair[0], $pair[1])] = true;
            }
        }
        foreach ($players as $i => $a) {
            foreach (array_slice($players, $i + 1) as $b) {
                $key = self::key($a, $b);
                $self->pairCost[$key] = ($partnerCounts[$key] ?? 0) + (isset($previous[$key]) ? self::REPEAT_PENALTY : 0);
            }
        }

        if (count($players) <= self::EXHAUSTIVE_LIMIT) {
            $self->search($players, [], 0.0, count($players) % 2 === 1);
        } else {
            $self->sample($players);
        }

        return self::normalize($self->best ?? []);
    }

    public static function key(int $a, int $b): string
    {
        return $a < $b ? "$a-$b" : "$b-$a";
    }

    private function search(array $remaining, array $pairs, float $cost, bool $byeAvailable): void
    {
        if ($cost > $this->bestCost) {
            return;
        }
        if ($remaining === []) {
            $this->offer($pairs, $cost);
            return;
        }
        $first = array_shift($remaining);
        if ($byeAvailable) {
            $this->search($remaining, [...$pairs, [$first]], $cost, false);
        }
        foreach ($remaining as $i => $partner) {
            $rest = $remaining;
            unset($rest[$i]);
            $this->search(array_values($rest), [...$pairs, [$first, $partner]], $cost + $this->pairCost[self::key($first, $partner)], $byeAvailable);
        }
    }

    /** Large groups: many random greedy splits, keep the cheapest. */
    private function sample(array $players): void
    {
        for ($n = 0; $n < self::SAMPLES; $n++) {
            $pool = $this->shuffle($players);
            $pairs = [];
            $cost = 0.0;
            if (count($pool) % 2 === 1) {
                $pairs[] = [array_pop($pool)];
            }
            while ($pool !== []) {
                $first = array_shift($pool);
                $bestIdx = 0;
                foreach ($pool as $i => $candidate) {
                    if ($this->pairCost[self::key($first, $candidate)] < $this->pairCost[self::key($first, $pool[$bestIdx])]) {
                        $bestIdx = $i;
                    }
                }
                $partner = $pool[$bestIdx];
                array_splice($pool, $bestIdx, 1);
                $pairs[] = [$first, $partner];
                $cost += $this->pairCost[self::key($first, $partner)];
            }
            $this->offer($pairs, $cost);
        }
    }

    /** Reservoir sampling over equally cheap splits so each tie is equally likely. */
    private function offer(array $pairs, float $cost): void
    {
        if ($cost < $this->bestCost) {
            $this->best = $pairs;
            $this->bestCost = $cost;
            $this->ties = 1;
        } elseif ($cost === $this->bestCost) {
            $this->ties++;
            if (($this->rand)(1, $this->ties) === 1) {
                $this->best = $pairs;
            }
        }
    }

    private function shuffle(array $items): array
    {
        for ($i = count($items) - 1; $i > 0; $i--) {
            $j = ($this->rand)(0, $i);
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }
        return $items;
    }

    /** Sorts players within pairs, puts the unpaired player last. */
    private static function normalize(array $pairs): array
    {
        $full = [];
        $single = [];
        foreach ($pairs as $pair) {
            sort($pair);
            if (count($pair) === 2) {
                $full[] = $pair;
            } else {
                $single[] = $pair;
            }
        }
        return [...$full, ...$single];
    }
}
