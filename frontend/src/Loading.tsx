import { Spin } from 'antd'

/** Centered spinner; `fullScreen` centers it in the viewport instead of the content area. */
export function Loading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: fullScreen ? '100dvh' : 160 }}>
      <Spin size={fullScreen ? 'large' : 'default'} />
    </div>
  )
}
