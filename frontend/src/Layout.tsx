import { BarChartOutlined, HistoryOutlined, LogoutOutlined, SettingOutlined, TrophyOutlined } from '@ant-design/icons'
import { Button, Flex, Select, Typography } from 'antd'
import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from './session'

export function Layout() {
  const { user, groups, group, isAdmin, selectGroup, signOut } = useSession()

  const tabs = [
    { to: '/', label: 'Today', icon: <TrophyOutlined /> },
    { to: '/history', label: 'History', icon: <HistoryOutlined /> },
    { to: '/stats', label: 'Stats', icon: <BarChartOutlined /> },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: <SettingOutlined /> }] : []),
  ]

  return (
    <div className="app">
      <header className="app-header">
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <img src="/favicon.svg" width={28} height={28} alt="" />
          {groups.length > 1 ? (
            <Select
              variant="borderless"
              value={group?.id}
              onChange={selectGroup}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              style={{ minWidth: 120, fontWeight: 600 }}
              popupMatchSelectWidth={false}
            />
          ) : (
            <Typography.Text strong ellipsis style={{ fontSize: 16 }}>
              {group?.name ?? 'Pickleball'}
            </Typography.Text>
          )}
        </Flex>
        <Flex align="center" gap={4}>
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: 110 }}>
            {user?.name}
          </Typography.Text>
          <Button type="text" icon={<LogoutOutlined />} onClick={signOut} aria-label="Sign out" />
        </Flex>
      </header>

      <main className="app-main">
        {group ? (
          // Remount screens when the group changes so their data reloads cleanly.
          <Outlet key={group.id} />
        ) : (
          <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 48 }}>
            You are not in any group yet. Ask an admin to add you.
          </Typography.Paragraph>
        )}
      </main>

      <nav className="app-nav">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
