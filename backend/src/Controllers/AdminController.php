<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Db;
use App\HttpError;
use App\Input;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** Superadmin-only: groups and the global player list. */
final class AdminController extends Controller
{
    public function groups(Request $request, Response $response): Response
    {
        Auth::requireSuperadmin($request);
        $rows = $this->db->all(
            'SELECT g.id, g.name, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members
             FROM player_groups g ORDER BY g.name',
        );
        return $this->json($response, array_map(fn ($r) => ['id' => (int) $r['id'], 'name' => $r['name'], 'members' => (int) $r['members']], $rows));
    }

    public function createGroup(Request $request, Response $response): Response
    {
        Auth::requireSuperadmin($request);
        $name = Input::string(Input::body($request), 'name');
        $id = $this->db->insert('player_groups', ['name' => $name, 'created_at' => Db::now()]);
        return $this->json($response, ['id' => $id], 201);
    }

    public function renameGroup(Request $request, Response $response, array $args): Response
    {
        Auth::requireSuperadmin($request);
        $name = Input::string(Input::body($request), 'name');
        if ($this->db->exec('UPDATE player_groups SET name = ? WHERE id = ?', [$name, (int) $args['id']]) === 0
            && $this->db->one('SELECT id FROM player_groups WHERE id = ?', [(int) $args['id']]) === null) {
            throw HttpError::notFound('Group not found');
        }
        return $this->json($response, ['ok' => true]);
    }

    public function users(Request $request, Response $response): Response
    {
        Auth::requireSuperadmin($request);
        $users = $this->db->all('SELECT id, name, email, password_hash IS NOT NULL AS has_account FROM users ORDER BY name');
        $memberships = $this->db->all('SELECT gm.user_id, g.name FROM group_members gm JOIN player_groups g ON g.id = gm.group_id');
        $groupsByUser = [];
        foreach ($memberships as $m) {
            $groupsByUser[(int) $m['user_id']][] = $m['name'];
        }
        return $this->json($response, array_map(fn ($u) => [
            'id' => (int) $u['id'],
            'name' => $u['name'],
            'email' => $u['email'],
            'has_account' => (bool) $u['has_account'],
            'groups' => $groupsByUser[(int) $u['id']] ?? [],
        ], $users));
    }
}
