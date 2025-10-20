import React from 'react'
import { Avatar, Box, Typography, SxProps, Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'

export type Member = {
  id: string
  name?: string | null
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
  withName?: boolean
}

export default function MemberAvatar({
  member,
  index,
  avatarSize = 100,
  sxBox = {},
  sxAvatar = {},
  withName = true,
}: Props) {
  const theme = useTheme()

  // extract from nested user object
  // const user = member?.user
  const name = member?.name || 'User'

  // derive initials from name
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const colors = [
    "#1976D2",
    "#9C27B0",
    "#E91E63",
    "#FF9800",
    "#4CAF50",
    "#0097A7",
    "#795548",
    "#F44336",
  ];
  const k = name ?? String(Math.random());
  let h = 0;
  for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  const color = colors[Math.abs(h) % colors.length];

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

      {withName && <Typography
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
      </Typography>}
    </Box>
  )
}
