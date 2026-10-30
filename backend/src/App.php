<?php

declare(strict_types=1);

namespace App;

use App\Controllers\AdminController;
use App\Controllers\AuthController;
use App\Controllers\DaysController;
use App\Controllers\MatchesController;
use App\Controllers\MembersController;
use App\Controllers\StatsController;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpException;
use Slim\Factory\AppFactory;
use Slim\Routing\RouteCollectorProxy;

final class App
{
    public static function create(array $config, Db $db): \Slim\App
    {
        $app = AppFactory::create();
        $app->setBasePath($config['base_path'] ?? '/api');

        $auth = new Auth($db, $config['jwt_secret']);
        $authC = new AuthController($db, $config, $auth);
        $members = new MembersController($db, $config);
        $days = new DaysController($db, $config);
        $matches = new MatchesController($db, $config);
        $stats = new StatsController($db, $config);
        $admin = new AdminController($db, $config);

        $app->post('/auth/login', [$authC, 'login']);
        $app->get('/invites/{token}', [$authC, 'inviteInfo']);
        $app->post('/invites/{token}/accept', [$authC, 'acceptInvite']);

        $app->group('', function (RouteCollectorProxy $r) use ($authC, $members, $days, $matches, $stats, $admin) {
            $r->get('/auth/me', [$authC, 'me']);

            $r->group('/groups/{gid:\d+}', function (RouteCollectorProxy $g) use ($members, $days, $matches, $stats) {
                $g->get('/members', [$members, 'list']);
                $g->post('/members', [$members, 'create']);
                $g->post('/members/existing', [$members, 'addExisting']);
                $g->patch('/members/{uid:\d+}', [$members, 'update']);
                $g->delete('/members/{uid:\d+}', [$members, 'remove']);
                $g->post('/members/{uid:\d+}/invite', [$members, 'invite']);

                $g->get('/days/{date}', [$days, 'get']);
                $g->put('/days/{date}/players', [$days, 'setPlayers']);
                $g->post('/days/{date}/roulette', [$days, 'roulette']);
                $g->put('/days/{date}/pairs', [$days, 'setPairs']);

                $g->get('/matches', [$matches, 'list']);
                $g->post('/matches', [$matches, 'create']);
                $g->patch('/matches/{id:\d+}', [$matches, 'update']);
                $g->delete('/matches/{id:\d+}', [$matches, 'delete']);
                $g->get('/matches/{id:\d+}/edits', [$matches, 'edits']);

                $g->get('/stats/pairs', [$stats, 'pairs']);
                $g->get('/stats/players', [$stats, 'players']);
            });

            $r->get('/admin/groups', [$admin, 'groups']);
            $r->post('/admin/groups', [$admin, 'createGroup']);
            $r->patch('/admin/groups/{id:\d+}', [$admin, 'renameGroup']);
            $r->get('/admin/users', [$admin, 'users']);
        })->add($auth);

        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $errors = $app->addErrorMiddleware((bool) ($config['debug'] ?? false), true, true);
        $errors->setDefaultErrorHandler(function (ServerRequestInterface $request, \Throwable $e) use ($app, $config): ResponseInterface {
            [$status, $message] = match (true) {
                $e instanceof HttpError => [$e->status, $e->getMessage()],
                $e instanceof HttpException => [$e->getCode(), $e->getMessage()],
                default => [500, ($config['debug'] ?? false) ? $e->getMessage() : 'Something went wrong'],
            };
            if ($status >= 500) {
                error_log((string) $e);
            }
            $response = $app->getResponseFactory()->createResponse($status);
            $response->getBody()->write(json_encode(['error' => $message], JSON_UNESCAPED_UNICODE));
            return $response->withHeader('Content-Type', 'application/json');
        });

        return $app;
    }
}
