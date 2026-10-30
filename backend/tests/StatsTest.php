<?php

declare(strict_types=1);

namespace Tests;

use App\Stats;
use PHPUnit\Framework\TestCase;

final class StatsTest extends TestCase
{
    private const MATCHES = [
        ['a1' => 1, 'a2' => 2, 'b1' => 3, 'b2' => 4, 'score_a' => 11, 'score_b' => 5],
        ['a1' => 1, 'a2' => 3, 'b1' => 2, 'b2' => 4, 'score_a' => 9, 'score_b' => 11],
    ];

    public function testPairs(): void
    {
        $pairs = Stats::pairs(self::MATCHES);
        $this->assertSame(1, $pairs['1-2']['wins']);
        $this->assertSame(1, $pairs['3-4']['losses']);
        $this->assertSame(1, $pairs['2-4']['wins']);
        $this->assertSame([2, 4], $pairs['2-4']['player_ids']);
        $this->assertSame(11, $pairs['2-4']['points_for']);
    }

    public function testPlayers(): void
    {
        $players = Stats::players(self::MATCHES);
        $this->assertSame(['player_id' => 2, 'games' => 2, 'wins' => 2, 'losses' => 0, 'points_for' => 22, 'points_against' => 14], $players[2]);
        $this->assertSame(0, $players[3]['wins']);
        $this->assertSame(1, $players[1]['wins']);
    }
}
