import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useAction, useLoad } from '../hooks'
import { Loading } from '../Loading'
import { useSession } from '../session'
import { AuthShell } from './LoginPage'

export function InvitePage() {
  const { token = '' } = useParams()
  const { signIn } = useSession()
  const run = useAction()
  const [saving, setSaving] = useState(false)
  const invite = useLoad(() => api.inviteInfo(token), [token])

  const onFinish = async ({ email, password }: { email: string; password: string }) => {
    setSaving(true)
    const res = await run(() => api.acceptInvite(token, email, password))
    if (res) {
      // Signing in unmounts this page; App then redirects /invite/* to the home screen.
      await signIn(res.token)
      return
    }
    setSaving(false)
  }

  return (
    <AuthShell>
      {invite.loading ? (
        <Loading />
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
