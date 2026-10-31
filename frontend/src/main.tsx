import { App as AntApp } from 'antd'
import 'dayjs/locale/en-gb'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'
import { SessionProvider } from './session'
import { ThemeProvider } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AntApp>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </AntApp>
    </ThemeProvider>
  </StrictMode>,
)
