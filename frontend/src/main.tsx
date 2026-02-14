import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ColorModeProvider } from './context/ColorModeContext'
import { SnackbarProvider } from './context/SnackbarProvider'
import { GroupsProvider } from './context/GroupContext'
import { TooltipProvider } from './components/ui/tooltip-ui'

import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://113a98c2b0bd8dcfe99ef51d7a13e2cd@o4510820456595456.ingest.us.sentry.io/4510820528816128",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    "localhost",
    "speakingclub.shubhpatel.in",
    "app.local"
  ]
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ColorModeProvider>
    <TooltipProvider>
      <BrowserRouter>
        <SnackbarProvider>
          <AuthProvider>
            <GroupsProvider>
              <App />
            </GroupsProvider>
          </AuthProvider>
        </SnackbarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ColorModeProvider>
)
