import { App as AntApp, ConfigProvider } from 'antd'
import enGB from 'antd/locale/en_GB'
import 'dayjs/locale/en-gb'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'
import { SessionProvider } from './session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={enGB} theme={{ token: { colorPrimary: '#15803d', borderRadius: 8 } }}>
      <AntApp>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
