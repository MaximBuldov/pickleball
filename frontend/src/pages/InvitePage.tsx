import { Alert, Button, Form, Input, Spin, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAction, useLoad } from '../hooks'
import { useSession } from '../session'
import { AuthShell } from './LoginPage'

export function InvitePage() {
  const { token = '' } = useParams()
  const { signIn } = useSession()
  const navigate = useNavigate()
  const run = useAction()
  const [saving, setSaving] = useState(false)
  const invite = useLoad(() => api.inviteInfo(token), [token])

  const onFinish = async ({ email, password }: { email: string; password: string }) => {
    setSaving(true)
    const res = await run(() => api.acceptInvite(token, email, password))
    if (res) {
      await signIn(res.token)
      navigate('/', { replace: true })
    }
    setSaving(false)
  }

  return (
    <AuthShell>
      {invite.loading ? (
        <Spin style={{ display: 'block' }} />
      ) : invite.error || !invite.data ? (
        <Alert type="error" title={invite.error} />
      ) : (
        <>
          <Typography.Paragraph style={{ textAlign: 'center' }}>
            Hi <b>{invite.data.name}</b>! Set your email and password to sign in.
          </Typography.Paragraph>
          <Form
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            initialValues={{ email: invite.data.email ?? '' }}
          >
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input size="large" autoComplete="email" inputMode="email" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={saving}>
              Continue
            </Button>
          </Form>
        </>
      )}
    </AuthShell>
  )
}
