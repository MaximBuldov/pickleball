import { PlusOutlined, ThunderboltOutlined, EditOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, Empty, Flex, Modal, Select, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { api, type GameDay, type Match, type Member, type Pair } from '../api'
import { MatchCard } from '../components/MatchCard'
import { MatchForm } from '../components/MatchForm'
import { Loading } from '../Loading'
import { useAction, useLoad, useMembers } from '../hooks'
import { useGroup } from '../session'
import { today } from '../util'

export function TodayPage() {
  const group = useGroup()
  const run = useAction()
  const [date, setDate] = useState(today())
  const members = useMembers(group.id)
  const day = useLoad(() => api.day(group.id, date), [group.id, date])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Match | null>(null)
  const [pairsOpen, setPairsOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)

  if (!members.data || !day.data) {
    return <Loading />
  }
  const d = day.data
  const allMembers = members.data
  const name = (id: number) => allMembers.find((m) => m.id === id)?.name ?? '?'
  const update = (next: GameDay | undefined) => next && day.setData(next)

  const togglePlayer = async (id: number) => {
    const ids = d.player_ids.includes(id) ? d.player_ids.filter((p) => p !== id) : [...d.player_ids, id]
    day.setData({ ...d, player_ids: ids })
    const next = await run(() => api.setDayPlayers(group.id, date, ids))
    if (next) day.setData(next)
    else void day.reload()
  }

  const spin = async () => {
    setSpinning(true)
    update(await run(() => api.roulette(group.id, date)))
    setSpinning(false)
  }

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {date === today() ? 'Today' : 'Game day'}
        </Typography.Title>
        <DatePicker
          value={dayjs(date)}
          allowClear={false}
          inputReadOnly
          format="D MMM YYYY"
          onChange={(v) => v && setDate(v.format('YYYY-MM-DD'))}
        />
      </Flex>

      <Card size="small" title={`Who's here (${d.player_ids.length})`}>
        <Flex wrap gap={8}>
          {allMembers.map((m) => (
            <Tag.CheckableTag
              key={m.id}
              checked={d.player_ids.includes(m.id)}
              onChange={() => togglePlayer(m.id)}
              style={{ fontSize: 15, padding: '6px 12px', border: '1px solid var(--pb-border-strong)', marginInlineEnd: 0 }}
            >
              {m.name}
              {m.status === 'guest' && <span style={{ opacity: 0.6 }}> · guest</span>}
            </Tag.CheckableTag>
          ))}
        </Flex>
      </Card>

      <Card
        size="small"
        title={d.pairs_manual ? 'Pairs (set by hand)' : 'Pairs'}
        extra={
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setPairsOpen(true)}>
            Edit
          </Button>
        }
      >
        {d.pairs.length > 0 ? (
          <Flex vertical gap={6}>
            {d.pairs.map((pair, i) =>
              pair.length === 2 ? (
                <Typography.Text key={pair.join('-')} style={{ fontSize: 16 }}>
                  <Tag color="green">{i + 1}</Tag>
                  {pair.map(name).join(' & ')}
                </Typography.Text>
              ) : (
                <Typography.Text key={pair.join('-')} type="secondary">
                  Without a pair: {name(pair[0])}
                </Typography.Text>
              ),
            )}
          </Flex>
        ) : (
          <Typography.Text type="secondary">Select who's here and spin the roulette.</Typography.Text>
        )}
        <Button
          type="primary"
          block
          size="large"
          icon={<ThunderboltOutlined />}
          style={{ marginTop: 12 }}
          loading={spinning}
          disabled={d.player_ids.length < 4}
          onClick={spin}
        >
          {d.pairs.length ? 'Spin again' : 'Roulette'}
        </Button>
      </Card>

      <Flex justify="space-between" align="center" style={{ marginTop: 4 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Matches ({d.matches.length})
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
          Add match
        </Button>
      </Flex>
      {d.matches.length ? (
        d.matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            onEdit={(match) => {
              setEditing(match)
              setFormOpen(true)
            }}
            onDeleted={day.reload}
          />
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matches yet" />
      )}

      <MatchForm
        open={formOpen}
        members={allMembers}
        pairs={editing ? [] : d.pairs}
        preferredIds={d.player_ids}
        match={editing}
        onCancel={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={async (data) => {
          const saved = editing
            ? await run(() => api.updateMatch(group.id, editing.id, data), 'Match updated')
            : await run(() => api.createMatch(group.id, { ...data, date }), 'Match saved')
          if (saved) void day.reload()
          return !!saved
        }}
      />

      <PairsEditor
        open={pairsOpen}
        members={allMembers}
        day={d}
        onClose={() => setPairsOpen(false)}
        onSave={async (pairs) => {
          const next = await run(() => api.setPairs(group.id, date, pairs), 'Pairs saved')
          update(next)
          return !!next
        }}
      />
    </Flex>
  )
}

interface PairsEditorProps {
  open: boolean
  members: Member[]
  day: GameDay
  onClose: () => void
  onSave: (pairs: Pair[]) => Promise<boolean>
}

/** Manual pairs: each row is a pair; players can come from anyone in the group. */
function PairsEditor({ open, members, day, onClose, onSave }: PairsEditorProps) {
  const [rows, setRows] = useState<number[][]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    const full = day.pairs.filter((p) => p.length === 2)
    setRows(full.length ? full.map((p) => [...p]) : [[], []])
  }
  const used = rows.flat()
  const options = (row: number[]) =>
    [...members]
      .sort((a, b) => Number(!day.player_ids.includes(a.id)) - Number(!day.player_ids.includes(b.id)) || a.name.localeCompare(b.name))
      .map((m) => ({ value: m.id, label: m.name, disabled: used.includes(m.id) && !row.includes(m.id) }))

  const save = async () => {
    setSaving(true)
    const pairs = rows.filter((r) => r.length > 0)
    if (await onSave(pairs)) onClose()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      title="Edit pairs"
      onCancel={onClose}
      afterOpenChange={(visible) => visible && reset()}
      destroyOnHidden
      footer={
        <Button type="primary" block size="large" loading={saving} onClick={save}>
          Save pairs
        </Button>
      }
    >
      <Flex vertical gap={8}>
        {rows.map((row, i) => (
          <Flex key={i} gap={8} align="center">
            <Tag color="green">{i + 1}</Tag>
            <Select
              mode="multiple"
              size="large"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Two players"
              value={row}
              options={options(row)}
              showSearch={{ optionFilterProp: 'label' }}
              onChange={(ids: number[]) => setRows(rows.map((r, j) => (j === i ? ids.slice(-2) : r)))}
            />
          </Flex>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setRows([...rows, []])}>
          Add pair
        </Button>
      </Flex>
    </Modal>
  )
}
