<?php

declare(strict_types=1);

namespace App;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Bearer-token auth. Attaches the current user row to the request as the "user" attribute.
 */
final class Auth implements MiddlewareInterface
{
    private const TOKEN_TTL = 90 * 24 * 3600;

    public function __construct(private Db $db, private string $secret)
    {
    }

    public function issueToken(int $userId): string
    {
        $now = time();
        return JWT::encode(['sub' => $userId, 'iat' => $now, 'exp' => $now + self::TOKEN_TTL], $this->secret, 'HS256');
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $header = $request->getHeaderLine('Authorization')
            ?: ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            throw new HttpError(401, 'Not signed in');
        }
        try {
            $payload = JWT::decode($m[1], new Key($this->secret, 'HS256'));
        } catch (\Throwable) {
            throw new HttpError(401, 'Session expired, please sign in again');
        }
        $user = $this->db->one(
            'SELECT id, name, email, is_superadmin FROM users WHERE id = ? AND password_hash IS NOT NULL',
            [(int) $payload->sub],
        );
        if ($user === null) {
            throw new HttpError(401, 'Account not found');
        }
        return $handler->handle($request->withAttribute('user', $user));
    }

    public static function user(ServerRequestInterface $request): array
    {
        return $request->getAttribute('user');
    }

    /** Returns the user's role in the group ("admin"/"member"); superadmins act as admins everywhere. */
    public static function requireMember(Db $db, ServerRequestInterface $request, int $groupId): string
    {
        $user = self::user($request);
        if ($user['is_superadmin']) {
            if ($db->one('SELECT id FROM player_groups WHERE id = ?', [$groupId]) === null) {
                throw HttpError::notFound('Group not found');
            }
            return 'admin';
        }
        $row = $db->one('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [$groupId, $user['id']]);
        if ($row === null) {
            throw HttpError::forbidden('You are not a member of this group');
        }
        return $row['role'];
    }

    public static function requireAdmin(Db $db, ServerRequestInterface $request, int $groupId): void
    {
        if (self::requireMember($db, $request, $groupId) !== 'admin') {
            throw HttpError::forbidden('Only group admins can do this');
        }
    }

    public static function requireSuperadmin(ServerRequestInterface $request): void
    {
        if (!self::user($request)['is_superadmin']) {
            throw HttpError::forbidden('Only the superadmin can do this');
        }
    }
}
