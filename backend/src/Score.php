<?php

declare(strict_types=1);

namespace App;

/**
 * Single game to 11, win by 2: 11:x needs x <= 9; past 11 the margin must be exactly 2 (12:10, 13:11...).
 */
final class Score
{
    /** Returns an error message, or null when the score is valid. */
    public static function validate(int $a, int $b): ?string
    {
        if ($a < 0 || $b < 0) {
            return 'Score cannot be negative';
        }
        if ($a === $b) {
            return 'A game cannot end in a draw';
        }
        $winner = max($a, $b);
        $loser = min($a, $b);
        if ($winner < 11) {
            return 'The winner must reach 11 points';
        }
        if ($winner === 11 && $loser > 9) {
            return 'Win by 2: at 10:10 the game continues (e.g. 12:10)';
        }
        if ($winner > 11 && $winner - $loser !== 2) {
            return 'Past 11 the game ends with a 2-point margin (e.g. 12:10, 13:11)';
        }
        return null;
    }
}
