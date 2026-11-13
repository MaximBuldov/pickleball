<?php

declare(strict_types=1);

namespace Tests;

use App\Rating;
use PHPUnit\Framework\TestCase;

final class RatingTest extends TestCase
{
    private static function match(int $id, string $date, array $a, array $b, int $sa, int $sb): array
    {
        return ['id' => $id, 'play_date' => $date, 'a1' => $a[0], 'a2' => $a[1], 'b1' => $b[0], 'b2' => $b[1], 'score_a' => $sa, 'score_b' => $sb];
    }

    public function testEqualTeamsMoveBySixteen(): void
    {
        $r = Rating::compute([self::match(1, '2026-11-01', [1, 2], [3, 4], 11, 5)]);
        $this->assertSame(1016.0, $r['current'][1]);
        $this->assertSame(984.0, $r['current'][3]);
        $this->assertSame(['2026-11-01' => 1016.0], $r['byDay'][2]);
    }

    public function testRatingIsZeroSumAndChronological(): void
    {
        // Passed newest first, like Matches::rows() returns them.
        $r = Rating::compute([
            self::match(3, '2026-11-08', [2, 3], [1, 4], 11, 7),
            self::match(2, '2026-11-01', [1, 3], [2, 4], 11, 9),
            self::match(1, '2026-11-01', [1, 2], [3, 4], 11, 5),
        ]);
        $this->assertEqualsWithDelta(4000, array_sum($r['current']), 1e-9);
        // Player 1 won both games on day one, then lost.
        $this->assertGreaterThan(1016, $r['byDay'][1]['2026-11-01']);
        $this->assertLessThan($r['byDay'][1]['2026-11-01'], $r['byDay'][1]['2026-11-08']);
    }

    public function testUpsetEarnsMoreThanExpectedWin(): void
    {
        $setup = [self::match(1, '2026-11-01', [1, 2], [3, 4], 11, 0), self::match(2, '2026-11-01', [1, 2], [3, 4], 11, 0)];
        $favourite = Rating::compute([...$setup, self::match(3, '2026-11-02', [1, 2], [3, 4], 11, 9)]);
        $underdog = Rating::compute([...$setup, self::match(3, '2026-11-02', [3, 4], [1, 2], 11, 9)]);
        $favouriteGain = $favourite['byDay'][1]['2026-11-02'] - $favourite['byDay'][1]['2026-11-01'];
        $underdogGain = $underdog['byDay'][3]['2026-11-02'] - $underdog['byDay'][3]['2026-11-01'];
        $this->assertGreaterThan($favouriteGain, $underdogGain);
    }
}
