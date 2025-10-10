import React from 'react'
import { Avatar, Box, Typography, SxProps, Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'

export type Member = {
  id: string
  role?: string
  user?: {
    id: string
    name?: string | null
    email?: string
  }
}

type Props = {
  member?: Member
  index?: number
  avatarSize?: number // default: 100
  sxBox?: SxProps<Theme>
  sxAvatar?: SxProps<Theme>
}

export default function MemberAvatar({
  member,
  index,
  avatarSize = 100,
  sxBox = {},
  sxAvatar = {},
}: Props) {
  const theme = useTheme()

  // extract from nested user object
  const user = member?.user
  const name = user?.name || user?.email || 'User'

  // derive initials from name
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // deterministic color palette
  const colors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    '#E91E63',
    '#4CAF50',
    '#FF9800',
    '#9C27B0',
    '#0097A7',
    '#F44336',
  ]

  // hash user name -> pick consistent color
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = colors[Math.abs(hash) % colors.length]

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: avatarSize + 20,
        ...sxBox,
      }}
    >
      <Avatar
        sx={{
          width: avatarSize,
          height: avatarSize,
          bgcolor: color,
          color: 'white',
          fontSize: avatarSize * 0.26,
          fontWeight: 600,
          transition: 'transform 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
          },
          ...sxAvatar,
        }}
      >
        {initials}
      </Avatar>

      <Typography
        variant="body2"
        sx={{
          mt: 1,
          textAlign: 'center',
          fontSize: '0.8rem',
          color: theme.palette.text.primary,
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </Typography>
    </Box>
  )
}
