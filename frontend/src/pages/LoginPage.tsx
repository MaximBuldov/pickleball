import { Button, Card, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { api } from '../api'
import { useAction } from '../hooks'
import { useSession } from '../session'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/favicon.svg" width={56} height={56} alt="" />
          <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
            Pickleball
          </Typography.Title>
        </div>
        {children}
      </Card>
    </div>
  )
}

export function LoginPage() {
  const { signIn } = useSession()
  const run = useAction()
  const [loading, setLoading] = useState(false)

  const onFinish = async ({ email, password }: { email: string; password: string }) => {
    setLoading(true)
    const res = await run(() => api.login(email, password))
    if (res) await signIn(res.token)
    setLoading(false)
  }

  return (
    <AuthShell>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input size="large" autoComplete="email" inputMode="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password size="large" autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          Sign in
        </Button>
      </Form>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center', fontSize: 13 }}>
        No account or forgot your password? Ask your group admin for an invite link.
      </Typography.Paragraph>
    </AuthShell>
  )
}
