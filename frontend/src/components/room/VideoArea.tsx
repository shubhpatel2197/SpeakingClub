import React from 'react'
import { Box, Typography } from '@mui/material'

export default function VideoArea() {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary',
        width: '100%',
      }}
    >
      <Typography variant="h5" fontWeight={500}>
        (Video / Stream Area)
      </Typography>
    </Box>
  )
}
