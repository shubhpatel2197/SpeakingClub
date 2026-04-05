'use client'

import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar-ui';

export type Member = {
  id: string
  name?: string | null
  avatar?: string | null
  role?: string
  user?: {
    id: string
    name?: string | null
    email?: string
    avatar?: string | null
  }
}

type Props = {
  member?: Member
  index?: number
  avatarSize?: number
  sxBox?: any
  sxAvatar?: any
  withName?: boolean
}

const colors = [
  "from-amber-600 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-600 to-teal-500",
  "from-violet-500 to-purple-500",
  "from-sky-500 to-indigo-500",
  "from-lime-600 to-green-500",
  "from-fuchsia-500 to-pink-500",
];

function deterministicColor(name?: string) {
  const k = name ?? String(Math.random());
  let h = 0;
  for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function MemberAvatar({
  member,
  avatarSize = 100,
  withName = true,
}: Props) {
  const name = member?.name || 'User';
  const avatarUrl = member?.avatar || member?.user?.avatar || null;

  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const gradientClass = deterministicColor(name);

  const sizeStyle = {
    width: avatarSize,
    height: avatarSize,
    fontSize: avatarSize * 0.26,
  };

  return (
    <div className="flex flex-col items-center justify-center" style={{ width: withName ? avatarSize + 20 : avatarSize }}>
      <Avatar
        className="ring-2 ring-primary/20 hover:ring-primary/50 hover:scale-105 transition-all duration-200"
        style={sizeStyle}
      >
        {avatarUrl && (
          <AvatarImage src={avatarUrl} alt={name} />
        )}
        <AvatarFallback
          className={cn("bg-gradient-to-br text-white font-semibold", gradientClass)}
          style={{ fontSize: avatarSize * 0.26 }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {withName && (
        <p
          className="mt-1 text-center text-xs text-foreground/80 w-full overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {name}
        </p>
      )}
    </div>
  );
}
