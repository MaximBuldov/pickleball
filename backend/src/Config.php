<?php

declare(strict_types=1);

namespace App;

/**
 * Loads config.php from the backend root (or the path in PICKLEBALL_CONFIG).
 * See config.example.php for the expected keys.
 */
final class Config
{
    public static function load(): array
    {
        $path = getenv('PICKLEBALL_CONFIG') ?: dirname(__DIR__) . '/config.php';
        if (!is_file($path)) {
            throw new \RuntimeException("Config file not found: $path");
        }
        return require $path;
    }
}
