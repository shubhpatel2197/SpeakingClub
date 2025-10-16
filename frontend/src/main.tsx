import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ColorModeProvider } from './context/ColorModeContext'
import { SnackbarProvider } from './context/SnackbarProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
      <SnackbarProvider>
        <AuthProvider>
          
          <App />
          
        </AuthProvider>
        </SnackbarProvider>
      </BrowserRouter>
    </ColorModeProvider>
  // </React.StrictMode>
)
