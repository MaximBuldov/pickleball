<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Db;
use App\HttpError;
use App\Input;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AuthController extends Controller
{
    public function __construct(Db $db, array $config, private Auth $auth)
    {
        parent::__construct($db, $config);
    }

    public function login(Request $request, Response $response): Response
    {
        $body = Input::body($request);
        $email = mb_strtolower(trim((string) ($body['email'] ?? '')));
        $user = $this->db->one('SELECT id, password_hash FROM users WHERE email = ?', [$email]);
        if ($user === null || $user['password_hash'] === null || !password_verify((string) ($body['password'] ?? ''), $user['password_hash'])) {
            throw new HttpError(401, 'Wrong email or password');
        }
        return $this->json($response, ['token' => $this->auth->issueToken((int) $user['id'])]);
    }

    public function me(Request $request, Response $response): Response
    {
        $user = Auth::user($request);
        if ($user['is_superadmin']) {
            $groups = $this->db->all("SELECT id, name, 'admin' AS role FROM player_groups ORDER BY name");
        } else {
            $groups = $this->db->all(
                'SELECT g.id, g.name, gm.role FROM group_members gm JOIN player_groups g ON g.id = gm.group_id WHERE gm.user_id = ? ORDER BY g.name',
                [$user['id']],
            );
        }
        return $this->json($response, [
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'is_superadmin' => (bool) $user['is_superadmin'],
            ],
            'groups' => array_map(fn ($g) => ['id' => (int) $g['id'], 'name' => $g['name'], 'role' => $g['role']], $groups),
        ]);
    }

    public function inviteInfo(Request $request, Response $response, array $args): Response
    {
        $invite = $this->findInvite($args['token']);
        return $this->json($response, ['name' => $invite['name'], 'email' => $invite['email']]);
    }

    public function acceptInvite(Request $request, Response $response, array $args): Response
    {
        $invite = $this->findInvite($args['token']);
        $body = Input::body($request);
        $email = mb_strtolower(Input::string($body, 'email', 190));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw HttpError::badRequest('Please enter a valid email');
        }
        $password = (string) ($body['password'] ?? '');
        if (mb_strlen($password) < 6) {
            throw HttpError::badRequest('Password must be at least 6 characters');
        }
        if ($this->db->one('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $invite['user_id']]) !== null) {
            throw HttpError::badRequest('This email is already used by another player');
        }

        $this->db->transaction(function () use ($invite, $email, $password) {
            $this->db->exec('UPDATE users SET email = ?, password_hash = ? WHERE id = ?', [
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                $invite['user_id'],
            ]);
            $this->db->exec('UPDATE invites SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [Db::now(), $invite['user_id']]);
        });

        return $this->json($response, ['token' => $this->auth->issueToken((int) $invite['user_id'])]);
    }

    private function findInvite(string $token): array
    {
        $invite = $this->db->one(
            'SELECT i.user_id, u.name, u.email FROM invites i JOIN users u ON u.id = i.user_id
             WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?',
            [hash('sha256', $token), Db::now()],
        );
        if ($invite === null) {
            throw HttpError::notFound('This invite link is invalid or has expired. Ask your admin for a new one.');
        }
        return $invite;
    }
}
