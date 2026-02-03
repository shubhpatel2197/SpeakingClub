import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ColorModeProvider } from './context/ColorModeContext'
import { SnackbarProvider } from './context/SnackbarProvider'
import { GroupsProvider } from './context/GroupContext'
// import { datadogRum } from '@datadog/browser-rum';
// import { reactPlugin } from '@datadog/browser-rum-react';

// datadogRum.init({
//   applicationId: '82c2d4a8-03aa-42da-858b-17dfd29f6eee',
//   clientToken: 'pubbe08793b275af5148e088715eb4e425a',
//   site: 'us5.datadoghq.com',
//   service:'project1',
//   env: 'devlopement',
//   sessionSampleRate:  100,
//   sessionReplaySampleRate: 20,
//   defaultPrivacyLevel: 'mask-user-input',
//   trackUserInteractions: true,
//   // plugins: [reactPlugin({ router: true })],
// });

import * as Sentry from "@sentry/react";


Sentry.init({
  dsn: "https://113a98c2b0bd8dcfe99ef51d7a13e2cd@o4510820456595456.ingest.us.sentry.io/4510820528816128",
  integrations: [Sentry.browserTracingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  // Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
});

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
