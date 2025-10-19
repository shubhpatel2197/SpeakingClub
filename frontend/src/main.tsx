import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ColorModeProvider } from './context/ColorModeContext'
import { SnackbarProvider } from './context/SnackbarProvider'
import { GroupsProvider } from './context/GroupContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
      <SnackbarProvider>
        <AuthProvider>
          <GroupsProvider>
          <App />
          </GroupsProvider>
        </AuthProvider>
        </SnackbarProvider>
      </BrowserRouter>
    </ColorModeProvider>
  // </React.StrictMode>
)
