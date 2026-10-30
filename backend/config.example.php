<?php

// Copy to config.php (never commit it). On the server it lives in ~/pickleball-backend/config.php.
return [
    'db' => [
        // Production (Namecheap MySQL):
        // 'dsn' => 'mysql:host=localhost;dbname=USER_pickleball;charset=utf8mb4',
        // 'user' => 'USER_pickleball',
        // 'password' => '...',
        // Local development:
        'dsn' => 'sqlite:' . __DIR__ . '/var/dev.sqlite',
    ],
    // At least 32 random characters: php -r 'echo bin2hex(random_bytes(32));'
    'jwt_secret' => 'change-me-change-me-change-me-change-me-change-me',
    // Used to build invite links.
    'app_url' => 'http://localhost:5173',
    'debug' => true,
];
