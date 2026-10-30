<?php

declare(strict_types=1);

namespace App;

/** Shared match queries and the JSON shape returned to the client. */
final class Matches
{
    private const SELECT = 'SELECT m.*, d.play_date FROM matches m JOIN game_days d ON d.id = m.game_day_id';

    public function __construct(private Db $db)
    {
    }

    /** Raw rows of a group's non-deleted matches, optionally limited to a date range (inclusive). */
    public function rows(int $groupId, ?string $from = null, ?string $to = null, ?int $gameDayId = null): array
    {
        $sql = self::SELECT . ' WHERE m.group_id = ? AND m.deleted_at IS NULL';
        $params = [$groupId];
        if ($from !== null) {
            $sql .= ' AND d.play_date >= ?';
            $params[] = $from;
        }
        if ($to !== null) {
            $sql .= ' AND d.play_date <= ?';
            $params[] = $to;
        }
        if ($gameDayId !== null) {
            $sql .= ' AND m.game_day_id = ?';
            $params[] = $gameDayId;
        }
        return $this->db->all($sql . ' ORDER BY d.play_date DESC, m.id DESC', $params);
    }

    public function find(int $groupId, int $matchId): array
    {
        $row = $this->db->one(self::SELECT . ' WHERE m.id = ? AND m.group_id = ? AND m.deleted_at IS NULL', [$matchId, $groupId]);
        if ($row === null) {
            throw HttpError::notFound('Match not found');
        }
        return $row;
    }

    public function format(array $rows): array
    {
        $ids = [];
        foreach ($rows as $r) {
            array_push($ids, $r['a1'], $r['a2'], $r['b1'], $r['b2']);
        }
        $names = $this->names($ids);
        $player = fn ($id) => ['id' => (int) $id, 'name' => $names[(int) $id] ?? 'Unknown'];
        return array_map(fn ($r) => [
            'id' => (int) $r['id'],
            'date' => $r['play_date'],
            'court' => (int) $r['court'],
            'team_a' => [$player($r['a1']), $player($r['a2'])],
            'team_b' => [$player($r['b1']), $player($r['b2'])],
            'score_a' => (int) $r['score_a'],
            'score_b' => (int) $r['score_b'],
            'created_at' => $r['created_at'],
            'edited_at' => $r['edited_at'],
        ], $rows);
    }

    /** @return array<int, string> user id => name */
    public function names(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }
        $rows = $this->db->all('SELECT id, name FROM users WHERE id IN (' . Db::placeholders($ids) . ')', $ids);
        return array_column($rows, 'name', 'id');
    }

    /** Snapshot stored in match_edits so the client can show what changed. */
    public static function snapshot(array $row, array $names): array
    {
        return [
            'date' => $row['play_date'],
            'court' => (int) $row['court'],
            'team_a' => [$names[(int) $row['a1']] ?? '?', $names[(int) $row['a2']] ?? '?'],
            'team_b' => [$names[(int) $row['b1']] ?? '?', $names[(int) $row['b2']] ?? '?'],
            'score_a' => (int) $row['score_a'],
            'score_b' => (int) $row['score_b'],
        ];
    }

    public function gameDay(int $groupId, string $date): ?array
    {
        return $this->db->one('SELECT * FROM game_days WHERE group_id = ? AND play_date = ?', [$groupId, $date]);
    }

    public function getOrCreateGameDay(int $groupId, string $date, int $userId): array
    {
        $day = $this->gameDay($groupId, $date);
        if ($day !== null) {
            return $day;
        }
        $this->db->insert('game_days', ['group_id' => $groupId, 'play_date' => $date, 'created_by' => $userId, 'created_at' => Db::now()]);
        return $this->gameDay($groupId, $date);
    }

    public function addAttendees(int $gameDayId, array $userIds): void
    {
        $existing = array_map('intval', array_column(
            $this->db->all('SELECT user_id FROM game_day_players WHERE game_day_id = ?', [$gameDayId]),
            'user_id',
        ));
        foreach (array_diff($userIds, $existing) as $userId) {
            $this->db->insert('game_day_players', ['game_day_id' => $gameDayId, 'user_id' => $userId]);
        }
    }

    /** Throws unless every id is a member of the group. */
    public function assertMembers(int $groupId, array $userIds): void
    {
        $userIds = array_values(array_unique($userIds));
        if ($userIds === []) {
            return;
        }
        $found = $this->db->one(
            'SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND user_id IN (' . Db::placeholders($userIds) . ')',
            [$groupId, ...$userIds],
        );
        if ((int) $found['n'] !== count($userIds)) {
            throw HttpError::badRequest('Some players are not in this group');
        }
    }
}
