<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use Psr\Http\Message\ResponseInterface as Response;

abstract class Controller
{
    public function __construct(protected Db $db, protected array $config)
    {
    }

    protected function json(Response $response, mixed $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
    }

    protected function inviteUrl(string $token): string
    {
        return rtrim($this->config['app_url'], '/') . '/invite/' . $token;
    }
}
