<?php

declare(strict_types=1);

namespace Tests;

use App\Score;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ScoreTest extends TestCase
{
    public static function valid(): array
    {
        return [[11, 0], [11, 9], [9, 11], [12, 10], [10, 12], [15, 13]];
    }

    public static function invalid(): array
    {
        return [[11, 10], [12, 9], [13, 10], [10, 8], [11, 11], [-1, 11], [14, 10]];
    }

    #[DataProvider('valid')]
    public function testValidScores(int $a, int $b): void
    {
        $this->assertNull(Score::validate($a, $b));
    }

    #[DataProvider('invalid')]
    public function testInvalidScores(int $a, int $b): void
    {
        $this->assertNotNull(Score::validate($a, $b));
    }
}
