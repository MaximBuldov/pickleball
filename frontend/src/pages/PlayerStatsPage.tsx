import { Card, Collapse, DatePicker, Empty, Flex, Select, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type DateRange, type PlayerDay, type PlayerProgress } from '../api'
import { useLoad, useMembers } from '../hooks'
import { Loading } from '../Loading'
import { useGroup, useSession } from '../session'
import { useThemeMode } from '../theme'
import { rangeValue, toRange } from './range'

/** Categorical slots 1–2 of the dataviz reference palette, validated on our light and dark surfaces. */
const PALETTE = {
  light: { series: ['#2a78d6', '#eb6834'], grid: '#f0f0f0', axis: '#8c8c8c', surface: '#ffffff', reference: '#bfbfbf' },
  dark: { series: ['#3987e5', '#d95926'], grid: '#303030', axis: '#8c8c8c', surface: '#141414', reference: '#595959' },
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Below this many games the with/without comparison is noise. */
const MIN_PARTNER_GAMES = 5

export function PlayerStatsPage() {
  const group = useGroup()
  const { user } = useSession()
  const members = useMembers(group.id)
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [compareId, setCompareId] = useState<number | null>(null)
  const [range, setRange] = useState<DateRange>({})

  const list = members.data ?? []
  const selected = playerId ?? (list.some((m) => m.id === user?.id) ? user!.id : list[0]?.id ?? null)

  const progress = useLoad(async () => {
    if (selected === null) return null
    const [main, other] = await Promise.all([
      api.playerProgress(group.id, selected, range),
      compareId !== null && compareId !== selected ? api.playerProgress(group.id, compareId, range) : Promise.resolve(null),
    ])
    return { main, other }
  }, [group.id, selected, compareId, range])

  if (!members.data) return <Loading />

  const options = list.map((m) => ({ value: m.id, label: m.name }))
  const data = progress.data

  return (
    <Flex vertical gap={12}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Stats
      </Typography.Title>
      <Flex gap={8}>
        <Select
          size="large"
          style={{ flex: 1, minWidth: 0 }}
          value={selected}
          options={options}
          onChange={setPlayerId}
          showSearch={{ optionFilterProp: 'label' }}
        />
        <Select
          size="large"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="Compare with…"
          allowClear
          value={compareId}
          options={options.filter((o) => o.value !== selected)}
          onChange={(v) => setCompareId(v ?? null)}
          showSearch={{ optionFilterProp: 'label' }}
        />
      </Flex>
      <DatePicker.RangePicker
        value={rangeValue(range)}
        onChange={(v) => setRange(toRange(v))}
        inputReadOnly
        format="D MMM YYYY"
        style={{ width: '100%' }}
      />

      {!data ? (
        <Loading />
      ) : data.main.days.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No games in this period" />
      ) : (
        <PlayerCharts main={data.main} other={data.other} />
      )}
    </Flex>
  )
}

function PlayerCharts({ main, other }: { main: PlayerProgress; other: PlayerProgress | null }) {
  const { mode } = useThemeMode()
  const colors = PALETTE[mode]
  const players = other ? [main, other] : [main]

  const rows = mergeByDate(players)
  const series = (name: (p: PlayerProgress) => string) =>
    players.map((p, i) => ({ key: `p${i}`, name: name(p), color: colors.series[i], dashed: i === 1 }))

  return (
    <>
      <SummaryTiles player={main} />

      <ChartCard title="Rating" subtitle="Elo after each game day. Start is 1000; beating stronger teams earns more.">
        <TrendChart
          data={rows.map((r) => ({ date: r.date, ...pick(r, (d) => d.rating) }))}
          lines={series((p) => p.player.name)}
          format={(v) => String(Math.round(v))}
          reference={{ y: 1000, label: 'Start' }}
        />
      </ChartCard>

      <ChartCard title="Win rate by day" subtitle="Share of games won on each game day.">
        <TrendChart
          data={rows.map((r) => ({ date: r.date, ...pick(r, (d) => d.wins / d.games) }))}
          lines={series((p) => p.player.name)}
          domain={[0, 1]}
          format={pct}
          reference={{ y: 0.5, label: '50%' }}
        />
      </ChartCard>

      {other ? (
        <ChartCard title="Point difference per game" subtitle="Average points scored minus conceded per game, by day.">
          <TrendChart
            data={rows.map((r) => ({ date: r.date, ...pick(r, (d) => (d.points_for - d.points_against) / d.games) }))}
            lines={series((p) => p.player.name)}
            format={(v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))}
            reference={{ y: 0, label: '0' }}
          />
        </ChartCard>
      ) : (
        <ChartCard title="Points per game" subtitle="Average points scored and conceded per game, by day.">
          <TrendChart
            data={main.days.map((d) => ({ date: d.date, scored: d.points_for / d.games, conceded: d.points_against / d.games }))}
            lines={[
              { key: 'scored', name: 'Scored', color: colors.series[0] },
              { key: 'conceded', name: 'Conceded', color: colors.series[1], dashed: true },
            ]}
            format={(v) => v.toFixed(1)}
          />
        </ChartCard>
      )}

      <Collapse
        size="small"
        items={[{ key: 'table', label: `Daily numbers · ${main.player.name}`, children: <DailyTable days={main.days} /> }]}
      />
    </>
  )
}

function SummaryTiles({ player }: { player: PlayerProgress }) {
  const t = player.totals
  const effect = player.partner_effect && player.partner_effect.games >= MIN_PARTNER_GAMES ? player.partner_effect : null
  const diff = effect ? effect.with_rate - effect.without_rate : 0
  const signed = (v: number) => (v > 0 ? `+${v}` : String(v))

  return (
    <Flex gap={8}>
      <Tile label="Rating" value={String(player.rating)} note={player.rating_change ? `${signed(player.rating_change)} in period` : 'no change'} />
      <Tile label="Games" value={`${t.wins}–${t.losses}`} note={t.games ? `${pct(t.wins / t.games)} won` : '—'} />
      <Tile
        label="Partners"
        value={effect ? `${signed(Math.round(diff * 100))}%` : '—'}
        note={effect ? `win ${pct(effect.with_rate)} with, ${pct(effect.without_rate)} without` : `needs ${MIN_PARTNER_GAMES}+ games`}
      />
    </Flex>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card size="small" style={{ flex: 1, minWidth: 0 }} styles={{ body: { padding: '10px 12px' } }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}>{value}</div>
      <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block' }}>
        {note}
      </Typography.Text>
    </Card>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card size="small" styles={{ body: { padding: '12px 8px 8px 0' } }}>
      <div style={{ paddingLeft: 12, marginBottom: 8 }}>
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
          {subtitle}
        </Typography.Text>
      </div>
      {children}
    </Card>
  )
}

interface LineSpec {
  key: string
  name: string
  color: string
  dashed?: boolean
}

interface TrendChartProps {
  data: Record<string, string | number | null>[]
  lines: LineSpec[]
  format: (v: number) => string
  domain?: [number, number]
  reference?: { y: number; label: string }
}

function TrendChart({ data, lines, format, domain, reference }: TrendChartProps) {
  const { mode } = useThemeMode()
  const c = PALETTE[mode]
  const tick = { fill: c.axis, fontSize: 11 }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => dayjs(d).format('D MMM')}
          tick={tick}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={16}
        />
        <YAxis
          width={40}
          tick={tick}
          tickLine={false}
          axisLine={false}
          tickFormatter={format}
          domain={domain ?? ['auto', 'auto']}
          allowDecimals
        />
        {reference && (
          <ReferenceLine y={reference.y} stroke={c.reference} strokeDasharray="4 4" ifOverflow="extendDomain" />
        )}
        <Tooltip
          cursor={{ stroke: c.axis, strokeWidth: 1 }}
          labelFormatter={(d) => dayjs(String(d)).format('ddd, D MMM YYYY')}
          formatter={(v, name) => [typeof v === 'number' ? format(v) : '—', name]}
          contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 13 }}
        />
        {lines.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />}
        {lines.map((l) => (
          <Line
            key={l.key}
            dataKey={l.key}
            name={l.name}
            type="linear"
            stroke={l.color}
            strokeWidth={2}
            strokeDasharray={l.dashed ? '6 3' : undefined}
            dot={{ r: 4, fill: l.color, stroke: c.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: l.color, stroke: c.surface, strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function DailyTable({ days }: { days: PlayerDay[] }) {
  return (
    <Table<PlayerDay>
      size="small"
      rowKey="date"
      pagination={false}
      dataSource={[...days].reverse()}
      scroll={{ x: 'max-content' }}
      columns={[
        { title: 'Date', dataIndex: 'date', render: (d: string) => dayjs(d).format('D MMM YYYY') },
        { title: 'G', dataIndex: 'games', align: 'right' },
        { title: 'W', dataIndex: 'wins', align: 'right' },
        { title: 'Win %', key: 'rate', align: 'right', render: (_, d) => pct(d.wins / d.games) },
        {
          title: 'Pts/game',
          key: 'pts',
          align: 'right',
          render: (_, d) => `${(d.points_for / d.games).toFixed(1)}:${(d.points_against / d.games).toFixed(1)}`,
        },
        { title: 'Rating', dataIndex: 'rating', align: 'right' },
      ]}
    />
  )
}

/** One row per date any of the players played; a player's own days are keyed by index. */
function mergeByDate(players: PlayerProgress[]) {
  const byDate = new Map<string, (PlayerDay | null)[]>()
  players.forEach((p, i) => {
    for (const d of p.days) {
      const row = byDate.get(d.date) ?? players.map(() => null)
      row[i] = d
      byDate.set(d.date, row)
    }
  })
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, days]) => ({ date, days }))
}

/** Turns a merged row into { p0: value, p1: value } with null for players who didn't play that day. */
function pick(row: { days: (PlayerDay | null)[] }, value: (d: PlayerDay) => number) {
  return Object.fromEntries(row.days.map((d, i) => [`p${i}`, d ? value(d) : null]))
}
