<?php

declare(strict_types=1);

// Applies migrations/*.sql in order, recording each one in schema_migrations.

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Config;
use App\Db;

$db = Db::fromConfig(Config::load());
$db->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME NOT NULL)');
$applied = array_column($db->all('SELECT name FROM schema_migrations'), 'name');

$files = glob(dirname(__DIR__) . '/migrations/*.sql');
sort($files);
foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $applied, true)) {
        continue;
    }
    $sql = file_get_contents($file);
    if ($db->isSqlite()) {
        $sql = str_replace('AUTO_INCREMENT', 'AUTOINCREMENT', $sql);
        $sql = preg_replace('/\)\s*ENGINE=[^;]*;/', ');', $sql);
    }
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    // MySQL DDL auto-commits, so each statement runs on its own.
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        $db->pdo->exec($statement);
    }
    $db->insert('schema_migrations', ['name' => $name, 'applied_at' => Db::now()]);
    echo "Applied $name\n";
}
echo "Migrations up to date\n";
