<?php

declare(strict_types=1);

// Creates the superadmin account and their first group.
// Usage: php bin/create-superadmin.php --name="Max" --email=you@example.com --password=secret --group="Friends"

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config;
use App\Db;

$opts = getopt('', ['name:', 'email:', 'password:', 'group:']);
foreach (['name', 'email', 'password', 'group'] as $key) {
    if (empty($opts[$key])) {
        fwrite(STDERR, "Missing --$key\n");
        exit(1);
    }
}

$db = Db::fromConfig(Config::load());
$email = mb_strtolower(trim($opts['email']));
if ($db->one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
    fwrite(STDERR, "A user with email $email already exists\n");
    exit(1);
}

$db->transaction(function () use ($db, $opts, $email) {
    $now = Db::now();
    $userId = $db->insert('users', [
        'name' => trim($opts['name']),
        'email' => $email,
        'password_hash' => password_hash($opts['password'], PASSWORD_DEFAULT),
        'is_superadmin' => 1,
        'created_at' => $now,
    ]);
    $groupId = $db->insert('player_groups', ['name' => trim($opts['group']), 'created_at' => $now]);
    $db->insert('group_members', ['group_id' => $groupId, 'user_id' => $userId, 'role' => 'admin', 'created_at' => $now]);
});
echo "Superadmin $email created with group \"{$opts['group']}\"\n";
