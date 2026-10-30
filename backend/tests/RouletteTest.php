<?php

declare(strict_types=1);

namespace Tests;

use App\Roulette;
use PHPUnit\Framework\TestCase;

final class RouletteTest extends TestCase
{
    public function testEveryPlayerAppearsOnce(): void
    {
        foreach ([4, 5, 6, 7, 9, 12, 13, 16] as $n) {
            $players = range(1, $n);
            $pairs = Roulette::generate($players, []);
            $flat = array_merge(...$pairs);
            sort($flat);
            $this->assertSame($players, $flat, "n=$n");
            $this->assertCount(intdiv($n + 1, 2), $pairs);
            if ($n % 2 === 1) {
                $this->assertCount(1, end($pairs), 'unpaired player is last');
            }
        }
    }

    public function testPrefersPartnersWhoPlayedTogetherLeast(): void
    {
        // 1-2 and 3-4 have partnered a lot; the only zero-cost splits avoid them.
        $counts = ['1-2' => 5, '3-4' => 5, '1-3' => 2, '2-4' => 2];
        for ($i = 0; $i < 20; $i++) {
            $this->assertSame([[1, 4], [2, 3]], Roulette::generate([1, 2, 3, 4], $counts));
        }
    }

    public function testAvoidsRepeatingPreviousRoundWhenFair(): void
    {
        $pairs = Roulette::generate([1, 2, 3, 4], [], [[1, 2], [3, 4]]);
        $this->assertNotContains([1, 2], $pairs);
        $this->assertNotContains([3, 4], $pairs);
    }

    public function testRepeatedSpinsBalancePartnerships(): void
    {
        // Simulate 15 rounds with 6 players, counting each round as played.
        $counts = [];
        for ($round = 0; $round < 15; $round++) {
            foreach (Roulette::generate(range(1, 6), $counts) as $pair) {
                $key = Roulette::key($pair[0], $pair[1]);
                $counts[$key] = ($counts[$key] ?? 0) + 1;
            }
        }
        // 15 rounds * 3 pairs = 45 partnerships over 15 possible pairs: perfectly 3 each.
        $this->assertCount(15, $counts);
        $this->assertSame([3], array_values(array_unique($counts)));
    }
}
