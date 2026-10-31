import { Alert, Button, Flex, InputNumber, Modal, Select, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { scoreError, type Match, type MatchInput, type Member, type Pair } from '../api'

interface Props {
  open: boolean
  members: Member[]
  /** Roulette pairs offered as one-tap shortcuts. */
  pairs?: Pair[]
  /** Players shown first in the pickers (e.g. who came today). */
  preferredIds?: number[]
  /** Set when editing an existing match. */
  match?: Match | null
  onCancel: () => void
  onSubmit: (data: Omit<MatchInput, 'date'>) => Promise<boolean>
}

export function MatchForm({ open, members, pairs = [], preferredIds = [], match, onCancel, onSubmit }: Props) {
  const [teamA, setTeamA] = useState<number[]>([])
  const [teamB, setTeamB] = useState<number[]>([])
  const [scoreA, setScoreA] = useState<number | null>(null)
  const [scoreB, setScoreB] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTeamA(match ? match.team_a.map((p) => p.id) : [])
    setTeamB(match ? match.team_b.map((p) => p.id) : [])
    setScoreA(match?.score_a ?? null)
    setScoreB(match?.score_b ?? null)
    setSubmitted(false)
  }, [open, match])

  const name = (id: number) => members.find((m) => m.id === id)?.name ?? match?.team_a.concat(match.team_b).find((p) => p.id === id)?.name ?? '?'
  const fullPairs = pairs.filter((p) => p.length === 2)
  const isPicked = (pair: Pair) => [teamA, teamB].some((t) => t.length === 2 && pair.every((id) => t.includes(id)))

  const pickPair = (pair: Pair) => {
    if (isPicked(pair)) {
      if (pair.every((id) => teamA.includes(id))) setTeamA([])
      else setTeamB([])
    } else if (teamA.length === 0) setTeamA(pair)
    else setTeamB(pair)
  }

  const options = (other: number[]) => {
    const sorted = [...members].sort((a, b) => {
      const pa = preferredIds.includes(a.id) ? 0 : 1
      const pb = preferredIds.includes(b.id) ? 0 : 1
      return pa - pb || a.name.localeCompare(b.name)
    })
    return sorted.map((m) => ({ value: m.id, label: m.name, disabled: other.includes(m.id) }))
  }

  const teamsError = teamA.length !== 2 || teamB.length !== 2 ? 'Pick two players for each team' : null
  const error = teamsError ?? scoreError(scoreA, scoreB)

  const submit = async () => {
    setSubmitted(true)
    if (error) return
    setSaving(true)
    const ok = await onSubmit({ team_a: teamA, team_b: teamB, score_a: scoreA!, score_b: scoreB! })
    setSaving(false)
    if (ok) onCancel()
  }

  return (
    <Modal
      open={open}
      title={match ? 'Edit match' : 'Add match'}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <Button type="primary" block size="large" loading={saving} onClick={submit}>
          {match ? 'Save changes' : 'Save match'}
        </Button>
      }
    >
      <Flex vertical gap={16}>
        {fullPairs.length > 0 && (
          <div>
            <Typography.Text type="secondary">Tap two pairs</Typography.Text>
            <Flex wrap gap={6} style={{ marginTop: 6 }}>
              {fullPairs.map((pair) => (
                <Tag.CheckableTag
                  key={pair.join('-')}
                  checked={isPicked(pair)}
                  onChange={() => pickPair(pair)}
                  style={{ fontSize: 14, padding: '4px 10px', border: '1px solid var(--pb-border-strong)' }}
                >
                  {pair.map(name).join(' & ')}
                </Tag.CheckableTag>
              ))}
            </Flex>
          </div>
        )}

        <TeamRow
          label="Team 1"
          value={teamA}
          onChange={setTeamA}
          options={options(teamB)}
          score={scoreA}
          onScore={setScoreA}
        />
        <TeamRow
          label="Team 2"
          value={teamB}
          onChange={setTeamB}
          options={options(teamA)}
          score={scoreB}
          onScore={setScoreB}
        />

        {submitted && error && <Alert type="error" title={error} showIcon />}
      </Flex>
    </Modal>
  )
}

interface TeamRowProps {
  label: string
  value: number[]
  onChange: (ids: number[]) => void
  options: { value: number; label: string; disabled: boolean }[]
  score: number | null
  onScore: (score: number | null) => void
}

function TeamRow({ label, value, onChange, options, score, onScore }: TeamRowProps) {
  return (
    <div>
      <Typography.Text strong>{label}</Typography.Text>
      <Flex gap={8} style={{ marginTop: 4 }}>
        <Select
          mode="multiple"
          style={{ flex: 1, minWidth: 0 }}
          size="large"
          placeholder="Two players"
          value={value}
          onChange={(ids: number[]) => onChange(ids.slice(-2))}
          options={options}
          showSearch={{ optionFilterProp: 'label' }}
        />
        <InputNumber
          size="large"
          style={{ width: 72 }}
          min={0}
          max={99}
          inputMode="numeric"
          placeholder="0"
          value={score}
          onChange={(v) => onScore(v === null ? null : Number(v))}
        />
      </Flex>
    </div>
  )
}
