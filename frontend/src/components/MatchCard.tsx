import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { App, Button, Card, Flex, Popconfirm, Popover, Spin, Tag, Typography } from 'antd'
import { useState } from 'react'
import { api, type Match, type MatchEdit, type MatchSnapshot, type PlayerRef } from '../api'
import { useAction } from '../hooks'
import { useGroup, useSession } from '../session'
import { formatDateTime } from '../util'

interface Props {
  match: Match
  onEdit?: (match: Match) => void
  onDeleted?: () => void
}

export function MatchCard({ match, onEdit, onDeleted }: Props) {
  const { isAdmin } = useSession()
  const group = useGroup()
  const run = useAction()
  const aWon = match.score_a > match.score_b

  return (
    <Card size="small" styles={{ body: { padding: '10px 12px' } }}>
      <Flex align="center" gap={8}>
        <Team players={match.team_a} won={aWon} />
        <Typography.Text strong style={{ fontSize: 18, whiteSpace: 'nowrap' }}>
          {match.score_a} : {match.score_b}
        </Typography.Text>
        <Team players={match.team_b} won={!aWon} align="right" />
      </Flex>
      {(match.edited_at || isAdmin) && (
        <Flex justify="space-between" align="center" style={{ marginTop: 6 }}>
          <span>{match.edited_at && <EditedTag matchId={match.id} groupId={group.id} />}</span>
          {isAdmin && (
            <Flex gap={4}>
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit?.(match)} aria-label="Edit match" />
              <Popconfirm
                title="Delete this match?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  if (await run(() => api.deleteMatch(group.id, match.id), 'Match deleted')) onDeleted?.()
                }}
              >
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Delete match" />
              </Popconfirm>
            </Flex>
          )}
        </Flex>
      )}
    </Card>
  )
}

function Team({ players, won, align = 'left' }: { players: PlayerRef[]; won: boolean; align?: 'left' | 'right' }) {
  return (
    <Flex vertical style={{ flex: 1, minWidth: 0, textAlign: align }}>
      {players.map((p) => (
        <Typography.Text key={p.id} strong={won} type={won ? undefined : 'secondary'} ellipsis>
          {p.name}
        </Typography.Text>
      ))}
    </Flex>
  )
}

function EditedTag({ matchId, groupId }: { matchId: number; groupId: number }) {
  const { message } = App.useApp()
  const [edits, setEdits] = useState<MatchEdit[] | null>(null)

  const load = async (open: boolean) => {
    if (!open || edits) return
    try {
      setEdits(await api.matchEdits(groupId, matchId))
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  return (
    <Popover
      trigger="click"
      title="Edit history"
      onOpenChange={load}
      content={
        edits ? (
          <Flex vertical gap={12} style={{ maxWidth: 280 }}>
            {edits.map((e, i) => (
              <div key={i}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTime(e.edited_at)} · {e.edited_by}
                </Typography.Text>
                {e.after && <ChangeList before={e.before} after={e.after} />}
              </div>
            ))}
          </Flex>
        ) : (
          <Spin size="small" />
        )
      }
    >
      <Tag color="orange" style={{ cursor: 'pointer', marginInlineEnd: 0 }}>
        edited
      </Tag>
    </Popover>
  )
}

function ChangeList({ before, after }: { before: MatchSnapshot; after: MatchSnapshot }) {
  const team = (t: string[]) => t.join(' & ')
  const rows: [string, string, string][] = []
  if (before.score_a !== after.score_a || before.score_b !== after.score_b) {
    rows.push(['Score', `${before.score_a}:${before.score_b}`, `${after.score_a}:${after.score_b}`])
  }
  if (team(before.team_a) !== team(after.team_a)) rows.push(['Team 1', team(before.team_a), team(after.team_a)])
  if (team(before.team_b) !== team(after.team_b)) rows.push(['Team 2', team(before.team_b), team(after.team_b)])
  if (before.court !== after.court) rows.push(['Court', String(before.court), String(after.court)])
  if (!rows.length) return <div>No visible changes</div>
  return (
    <>
      {rows.map(([label, from, to]) => (
        <div key={label}>
          <b>{label}:</b> <Typography.Text delete>{from}</Typography.Text> → {to}
        </div>
      ))}
    </>
  )
}
