'use client'

import React from 'react'
import { ColorModeProvider } from './ColorModeContext'
import { SnackbarProvider } from './SnackbarProvider'
import { AuthProvider } from './AuthProvider'
import { GroupsProvider } from './GroupContext'
import { FriendRequestsProvider } from './FriendRequestsProvider'
import { TooltipProvider } from '@/components/ui/tooltip-ui'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ColorModeProvider>
      <TooltipProvider>
        <SnackbarProvider>
          <AuthProvider>
            <FriendRequestsProvider>
              <GroupsProvider>
                {children}
              </GroupsProvider>
            </FriendRequestsProvider>
          </AuthProvider>
        </SnackbarProvider>
      </TooltipProvider>
    </ColorModeProvider>
  )
}
