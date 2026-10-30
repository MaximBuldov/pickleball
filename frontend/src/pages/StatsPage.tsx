import { DatePicker, Flex, InputNumber, Segmented, Table, Typography, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { api, type DateRange, type Totals } from '../api'
import { useLoad } from '../hooks'
import { useGroup } from '../session'
import { rangeValue, toRange } from './range'

type Tab = 'pairs' | 'players'

interface Row extends Totals {
  key: string
  name: string
}

export function StatsPage() {
  const group = useGroup()
  const [tab, setTab] = useState<Tab>('pairs')
  const [range, setRange] = useState<DateRange>({})
  const [minGames, setMinGames] = useState(1)

  const stats = useLoad<Row[]>(async () => {
    if (tab === 'pairs') {
      const rows = await api.pairStats(group.id, range)
      return rows.map((r) => ({ ...r, key: r.players.map((p) => p.id).join('-'), name: r.players.map((p) => p.name).join(' & ') }))
    }
    const rows = await api.playerStats(group.id, range)
    return rows.map((r) => ({ ...r, key: String(r.player.id), name: r.player.name }))
  }, [group.id, tab, range])

  const winRate = (r: Row) => (r.games >= minGames && r.games > 0 ? r.wins / r.games : null)

  const columns: TableColumnsType<Row> = [
    {
      title: tab === 'pairs' ? 'Pair' : 'Player',
      dataIndex: 'name',
      fixed: 'left',
      width: tab === 'pairs' ? 130 : 100,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    { title: 'W', dataIndex: 'wins', align: 'right', defaultSortOrder: 'descend', sorter: (a, b) => a.wins - b.wins || b.losses - a.losses },
    { title: 'L', dataIndex: 'losses', align: 'right', sorter: (a, b) => a.losses - b.losses },
    { title: 'G', dataIndex: 'games', align: 'right', sorter: (a, b) => a.games - b.games },
    {
      title: 'Win %',
      key: 'rate',
      align: 'right',
      render: (_, r) => {
        const rate = winRate(r)
        return rate === null ? <Typography.Text type="secondary">—</Typography.Text> : `${Math.round(rate * 100)}%`
      },
      // Rows below the minimum always sink to the bottom, whatever the direction.
      sorter: (a, b, order) => {
        const ra = winRate(a)
        const rb = winRate(b)
        if (ra === null || rb === null) {
          const sink = order === 'ascend' ? 1 : -1
          return ra === rb ? 0 : ra === null ? sink : -sink
        }
        return ra - rb || a.games - b.games
      },
    },
    {
      title: 'Diff',
      key: 'diff',
      align: 'right',
      render: (_, r) => {
        const diff = r.points_for - r.points_against
        return diff > 0 ? `+${diff}` : diff
      },
      sorter: (a, b) => a.points_for - a.points_against - (b.points_for - b.points_against),
    },
    {
      title: 'Pts',
      key: 'points',
      align: 'right',
      render: (_, r) => `${r.points_for}:${r.points_against}`,
      sorter: (a, b) => a.points_for - b.points_for,
    },
  ]

  return (
    <Flex vertical gap={12}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Stats
      </Typography.Title>
      <Segmented<Tab>
        block
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Pairs', value: 'pairs' },
          { label: 'Players', value: 'players' },
        ]}
      />
      <DatePicker.RangePicker
        value={rangeValue(range)}
        onChange={(v) => setRange(toRange(v))}
        inputReadOnly
        format="D MMM YYYY"
        style={{ width: '100%' }}
      />
      <Flex align="center" gap={8}>
        <Typography.Text>Min games for Win %</Typography.Text>
        <InputNumber min={1} max={999} value={minGames} onChange={(v) => setMinGames(v ?? 1)} inputMode="numeric" style={{ width: 72 }} />
      </Flex>
      <Table<Row>
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={stats.data ?? []}
        loading={stats.loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        showSorterTooltip={false}
        sortDirections={['descend', 'ascend']}
        locale={{ emptyText: 'No matches in this period' }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        W/L — wins/losses, G — games, Diff — points scored minus conceded, Pts — points scored:conceded.
      </Typography.Text>
    </Flex>
  )
}
