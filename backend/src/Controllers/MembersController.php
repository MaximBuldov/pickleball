<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Db;
use App\HttpError;
use App\Input;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Players of a group: active accounts, invited players and guests (players without an account). */
final class MembersController extends Controller
{
    private const INVITE_TTL_DAYS = 14;

    public function list(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $isAdmin = Auth::requireMember($this->db, $request, $groupId) === 'admin';
        $rows = $this->db->all(
            'SELECT u.id, u.name, u.email, u.password_hash IS NOT NULL AS has_account, gm.role,
                    (SELECT COUNT(*) FROM invites i WHERE i.user_id = u.id AND i.used_at IS NULL AND i.expires_at > ?) AS open_invites
             FROM group_members gm JOIN users u ON u.id = gm.user_id
             WHERE gm.group_id = ? ORDER BY u.name',
            [Db::now(), $groupId],
        );
        return $this->json($response, array_map(fn ($r) => [
            'id' => (int) $r['id'],
            'name' => $r['name'],
            'email' => $isAdmin ? $r['email'] : null,
            'role' => $r['role'],
            'status' => $r['has_account'] ? 'active' : ($r['open_invites'] > 0 ? 'invited' : 'guest'),
        ], $rows));
    }

    /** Creates a guest. An admin can invite them later; their history is kept. */
    public function create(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireAdmin($this->db, $request, $groupId);
        $name = Input::string(Input::body($request), 'name');
        $this->assertNameFree($groupId, $name);

        $id = $this->db->transaction(function () use ($groupId, $name) {
            $id = $this->db->insert('users', ['name' => $name, 'created_at' => Db::now()]);
            $this->db->insert('group_members', ['group_id' => $groupId, 'user_id' => $id, 'role' => 'member', 'created_at' => Db::now()]);
            return $id;
        });
        return $this->json($response, ['id' => $id], 201);
    }

    /** Superadmin: adds an existing player (e.g. from another group) to this group. */
    public function addExisting(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        Auth::requireSuperadmin($request);
        $userId = Input::int(Input::body($request), 'user_id');
        if ($this->db->one('SELECT id FROM users WHERE id = ?', [$userId]) === null) {
            throw HttpError::notFound('Player not found');
        }
        if ($this->membership($groupId, $userId) !== null) {
            throw HttpError::badRequest('Player is already in this group');
        }
        $this->db->insert('group_members', ['group_id' => $groupId, 'user_id' => $userId, 'role' => 'member', 'created_at' => Db::now()]);
        return $this->json($response, ['ok' => true], 201);
    }

    /** Admins can rename; only the superadmin can change roles. */
    public function update(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $userId = (int) $args['uid'];
        Auth::requireAdmin($this->db, $request, $groupId);
        if ($this->membership($groupId, $userId) === null) {
            throw HttpError::notFound('Player not found in this group');
        }
        $body = Input::body($request);

        if (array_key_exists('name', $body)) {
            $name = Input::string($body, 'name');
            $this->assertNameFree($groupId, $name, $userId);
            $this->db->exec('UPDATE users SET name = ? WHERE id = ?', [$name, $userId]);
        }
        if (array_key_exists('role', $body)) {
            Auth::requireSuperadmin($request);
            if (!in_array($body['role'], ['admin', 'member'], true)) {
                throw HttpError::badRequest('Role must be "admin" or "member"');
            }
            $this->db->exec('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?', [$body['role'], $groupId, $userId]);
        }
        return $this->json($response, ['ok' => true]);
    }

    /** Removes the player from the group; their past matches stay in history and stats. */
    public function remove(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $userId = (int) $args['uid'];
        Auth::requireAdmin($this->db, $request, $groupId);
        if ($userId === (int) Auth::user($request)['id']) {
            throw HttpError::badRequest('You cannot remove yourself');
        }
        $this->db->transaction(function () use ($groupId, $userId) {
            $this->db->exec('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [$groupId, $userId]);
            $this->db->exec(
                'DELETE FROM game_day_players WHERE user_id = ? AND game_day_id IN (SELECT id FROM game_days WHERE group_id = ?)',
                [$userId, $groupId],
            );
        });
        return $this->json($response, ['ok' => true]);
    }

    /**
     * Creates a one-time link. For a guest it turns them into a full account;
     * for an active player it works as a password reset.
     */
    public function invite(Request $request, Response $response, array $args): Response
    {
        $groupId = (int) $args['gid'];
        $userId = (int) $args['uid'];
        Auth::requireAdmin($this->db, $request, $groupId);
        if ($this->membership($groupId, $userId) === null) {
            throw HttpError::notFound('Player not found in this group');
        }
        $token = bin2hex(random_bytes(24));
        $this->db->insert('invites', [
            'token_hash' => hash('sha256', $token),
            'user_id' => $userId,
            'created_by' => Auth::user($request)['id'],
            'created_at' => Db::now(),
            'expires_at' => gmdate('Y-m-d H:i:s', time() + self::INVITE_TTL_DAYS * 86400),
        ]);
        return $this->json($response, ['url' => $this->inviteUrl($token), 'expires_in_days' => self::INVITE_TTL_DAYS], 201);
    }

    private function membership(int $groupId, int $userId): ?array
    {
        return $this->db->one('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [$groupId, $userId]);
    }

    private function assertNameFree(int $groupId, string $name, ?int $exceptUserId = null): void
    {
        $clash = $this->db->one(
            'SELECT u.id FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? AND LOWER(u.name) = LOWER(?) AND u.id <> ?',
            [$groupId, $name, $exceptUserId ?? 0],
        );
        if ($clash !== null) {
            throw HttpError::badRequest("There is already a player named \"$name\" in this group");
        }
    }
}
