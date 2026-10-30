import { DatePicker, Empty, Flex, Spin, Typography } from 'antd'
import { useState } from 'react'
import { api, type DateRange, type Match } from '../api'
import { MatchCard } from '../components/MatchCard'
import { MatchForm } from '../components/MatchForm'
import { useAction, useLoad, useMembers } from '../hooks'
import { useGroup } from '../session'
import { formatDate } from '../util'
import { rangeValue, toRange } from './range'

export function HistoryPage() {
  const group = useGroup()
  const run = useAction()
  const [range, setRange] = useState<DateRange>({})
  const matches = useLoad(() => api.matches(group.id, range), [group.id, range])
  const members = useMembers(group.id)
  const [editing, setEditing] = useState<Match | null>(null)

  const byDate = new Map<string, Match[]>()
  for (const m of matches.data ?? []) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m])

  return (
    <Flex vertical gap={12}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        History
      </Typography.Title>
      <DatePicker.RangePicker
        value={rangeValue(range)}
        onChange={(v) => setRange(toRange(v))}
        inputReadOnly
        format="D MMM YYYY"
        style={{ width: '100%' }}
      />
      {matches.loading && !matches.data ? (
        <Spin style={{ display: 'block', marginTop: 48 }} />
      ) : byDate.size === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matches" />
      ) : (
        [...byDate].map(([date, list]) => (
          <Flex vertical gap={8} key={date}>
            <Typography.Text type="secondary" strong style={{ marginTop: 8 }}>
              {formatDate(date)} · {list.length} {list.length === 1 ? 'match' : 'matches'}
            </Typography.Text>
            {list.map((m) => (
              <MatchCard key={m.id} match={m} onEdit={setEditing} onDeleted={matches.reload} />
            ))}
          </Flex>
        ))
      )}

      <MatchForm
        open={!!editing}
        members={members.data ?? []}
        match={editing}
        onCancel={() => setEditing(null)}
        onSubmit={async (data) => {
          const saved = await run(() => api.updateMatch(group.id, editing!.id, data), 'Match updated')
          if (saved) void matches.reload()
          return !!saved
        }}
      />
    </Flex>
  )
}
