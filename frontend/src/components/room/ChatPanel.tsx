import React from 'react'
import { Box, IconButton, Typography, Divider } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface ChatPanelProps {
  onClose: () => void
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  return (
    <Box
      sx={{
        width: 320,
        borderLeft: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Chat
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
        <Typography variant="body2" color="text.secondary">
          Messages will appear here...
        </Typography>
      </Box>
    </Box>
  )
}
