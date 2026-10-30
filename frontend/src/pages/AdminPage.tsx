import { CopyOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { App, Button, Card, Flex, Input, Modal, Popconfirm, Select, Tag, Typography } from 'antd'
import { useState } from 'react'
import { api, type Member } from '../api'
import { useAction, useLoad, useMembers } from '../hooks'
import { useGroup, useSession } from '../session'

const STATUS: Record<Member['status'], { color: string; label: string }> = {
  active: { color: 'green', label: 'Active' },
  invited: { color: 'blue', label: 'Invited' },
  guest: { color: 'default', label: 'Guest' },
}

export function AdminPage() {
  const group = useGroup()
  const { user } = useSession()
  const members = useMembers(group.id)

  return (
    <Flex vertical gap={12}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Admin · {group.name}
      </Typography.Title>
      <PlayersCard members={members.data ?? []} loading={members.loading} reload={members.reload} />
      {user?.is_superadmin && <SuperadminCard members={members.data ?? []} reloadMembers={members.reload} />}
    </Flex>
  )
}

function PlayersCard({ members, loading, reload }: { members: Member[]; loading: boolean; reload: () => Promise<void> }) {
  const group = useGroup()
  const { user, reload: reloadSession } = useSession()
  const run = useAction()
  const { message } = App.useApp()
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<Member | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [invite, setInvite] = useState<{ name: string; url: string; days: number } | null>(null)

  const addGuest = async () => {
    if (!newName.trim()) return
    if (await run(() => api.createGuest(group.id, newName.trim()), 'Guest added')) {
      setNewName('')
      void reload()
    }
  }

  const makeInvite = async (m: Member) => {
    const res = await run(() => api.invite(group.id, m.id))
    if (res) {
      setInvite({ name: m.name, url: res.url, days: res.expires_in_days })
      void reload()
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('Link copied')
    } catch {
      message.error('Could not copy, please select the link manually')
    }
  }

  return (
    <Card size="small" title={`Players (${members.length})`} loading={loading && !members.length}>
      <Flex gap={8} style={{ marginBottom: 12 }}>
        <Input placeholder="New guest name" value={newName} onChange={(e) => setNewName(e.target.value)} onPressEnter={addGuest} />
        <Button type="primary" icon={<PlusOutlined />} onClick={addGuest}>
          Add
        </Button>
      </Flex>

      <Flex vertical>
        {members.map((m) => (
          <Flex key={m.id} align="center" gap={8} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
            <Flex vertical style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text strong ellipsis>
                {m.name} {m.role === 'admin' && <Tag color="gold">admin</Tag>}
              </Typography.Text>
              <span>
                <Tag color={STATUS[m.status].color}>{STATUS[m.status].label}</Tag>
                {m.email && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {m.email}
                  </Typography.Text>
                )}
              </span>
            </Flex>
            {user?.is_superadmin && m.status === 'active' && (
              <Select
                size="small"
                value={m.role}
                style={{ width: 96 }}
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'admin', label: 'Admin' },
                ]}
                onChange={async (role) => {
                  if (await run(() => api.updateMember(group.id, m.id, { role }), 'Role updated')) {
                    void reload()
                    if (m.id === user.id) void reloadSession()
                  }
                }}
              />
            )}
            <Button
              size="small"
              icon={<LinkOutlined />}
              title={m.status === 'active' ? 'Password reset link' : 'Invite link'}
              onClick={() => makeInvite(m)}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              title="Rename"
              onClick={() => {
                setRenaming(m)
                setRenameValue(m.name)
              }}
            />
            {m.id !== user?.id && (
              <Popconfirm
                title={`Remove ${m.name} from the group?`}
                description="Their past matches stay in history and stats."
                okText="Remove"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  if (await run(() => api.removeMember(group.id, m.id), 'Player removed')) void reload()
                }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} title="Remove" />
              </Popconfirm>
            )}
          </Flex>
        ))}
      </Flex>

      <Modal
        open={!!renaming}
        title="Rename player"
        okText="Save"
        onCancel={() => setRenaming(null)}
        onOk={async () => {
          if (renaming && (await run(() => api.updateMember(group.id, renaming.id, { name: renameValue.trim() }), 'Saved'))) {
            setRenaming(null)
            void reload()
          }
        }}
      >
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>

      <Modal open={!!invite} title={`Link for ${invite?.name}`} footer={null} onCancel={() => setInvite(null)}>
        <Typography.Paragraph>
          Send this link to {invite?.name}. They will set their email and password. It works once and expires in {invite?.days}{' '}
          days.
        </Typography.Paragraph>
        <Input.TextArea value={invite?.url} readOnly autoSize />
        <Flex gap={8} style={{ marginTop: 12 }}>
          <Button block icon={<CopyOutlined />} onClick={() => invite && copy(invite.url)}>
            Copy
          </Button>
          {'share' in navigator && (
            <Button
              block
              type="primary"
              icon={<ShareAltOutlined />}
              onClick={() => invite && navigator.share({ title: 'Pickleball', text: 'Join our pickleball app:', url: invite.url }).catch(() => {})}
            >
              Share
            </Button>
          )}
        </Flex>
      </Modal>
    </Card>
  )
}

function SuperadminCard({ members, reloadMembers }: { members: Member[]; reloadMembers: () => Promise<void> }) {
  const group = useGroup()
  const { reload: reloadSession, selectGroup } = useSession()
  const run = useAction()
  const groups = useLoad(() => api.adminGroups(), [])
  const users = useLoad(() => api.adminUsers(), [])
  const [newGroup, setNewGroup] = useState('')
  const [existing, setExisting] = useState<number | null>(null)

  const outsiders = (users.data ?? []).filter((u) => !members.some((m) => m.id === u.id))

  return (
    <Card size="small" title="Superadmin">
      <Typography.Text strong>Groups</Typography.Text>
      <Flex vertical gap={4} style={{ margin: '8px 0 12px' }}>
        {(groups.data ?? []).map((g) => (
          <Flex key={g.id} justify="space-between" align="center">
            <Typography.Text
              editable={{
                onChange: async (name) => {
                  if (name.trim() && name !== g.name && (await run(() => api.renameGroup(g.id, name.trim()), 'Group renamed'))) {
                    void groups.reload()
                    void reloadSession()
                  }
                },
              }}
            >
              {g.name}
            </Typography.Text>
            <Typography.Text type="secondary">
              {g.members} {g.members === 1 ? 'player' : 'players'} {g.id === group.id && <Tag color="green">current</Tag>}
            </Typography.Text>
          </Flex>
        ))}
      </Flex>
      <Flex gap={8}>
        <Input placeholder="New group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <Button
          icon={<PlusOutlined />}
          onClick={async () => {
            if (!newGroup.trim()) return
            const res = await run(() => api.createGroup(newGroup.trim()), 'Group created')
            if (res) {
              setNewGroup('')
              void groups.reload()
              await reloadSession()
              selectGroup(res.id)
            }
          }}
        >
          Create
        </Button>
      </Flex>

      <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>
        Add a player from another group
      </Typography.Text>
      <Flex gap={8} style={{ marginTop: 8 }}>
        <Select
          style={{ flex: 1, minWidth: 0 }}
          placeholder="Choose player"
          value={existing}
          onChange={setExisting}
          showSearch={{ optionFilterProp: 'label' }}
          options={outsiders.map((u) => ({ value: u.id, label: `${u.name}${u.groups.length ? ` (${u.groups.join(', ')})` : ''}` }))}
        />
        <Button
          disabled={!existing}
          onClick={async () => {
            if (existing && (await run(() => api.addExistingMember(group.id, existing), 'Player added'))) {
              setExisting(null)
              void reloadMembers()
              void users.reload()
              void groups.reload()
            }
          }}
        >
          Add
        </Button>
      </Flex>
    </Card>
  )
}
