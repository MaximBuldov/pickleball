import {
  BarChartOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MoonOutlined,
  ReloadOutlined,
  SettingOutlined,
  SunOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { Button, Flex, Select, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { refreshAll } from './hooks'
import { PullToRefresh } from './PullToRefresh'
import { useSession } from './session'
import { useThemeMode } from './theme'

export function Layout() {
  const { user, groups, group, isAdmin, selectGroup, signOut, reload } = useSession()
  const [refreshing, setRefreshing] = useState(false)
  const { mode, toggle } = useThemeMode()

  const refresh = useCallback(async () => {
    setRefreshing(true)
    // Keep the spinner visible briefly so a fast refresh still registers.
    await Promise.all([refreshAll(), reload(), new Promise((r) => setTimeout(r, 500))])
    setRefreshing(false)
  }, [reload])

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
          <Button type="text" icon={<ReloadOutlined spin={refreshing} />} onClick={refresh} aria-label="Refresh" />
          <Button
            type="text"
            icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggle}
            aria-label={mode === 'dark' ? 'Light mode' : 'Dark mode'}
          />
          <Button type="text" icon={<LogoutOutlined />} onClick={signOut} aria-label="Sign out" />
        </Flex>
      </header>

      <PullToRefresh onRefresh={refresh} />

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
