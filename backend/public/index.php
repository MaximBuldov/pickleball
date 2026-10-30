<?php

declare(strict_types=1);

// Warnings go to the log; printing them would corrupt JSON responses.
ini_set('display_errors', '0');

require dirname(__DIR__) . '/vendor/autoload.php';

$config = App\Config::load();
App\App::create($config, App\Db::fromConfig($config))->run();
