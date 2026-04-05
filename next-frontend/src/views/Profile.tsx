'use client'

import React, { useState } from 'react'
import { useAuthContext } from '../context/AuthProvider'
import { useSnackbar } from '../context/SnackbarProvider'
import axiosInstance from '../api/axiosInstance'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Check, Pencil } from 'lucide-react'

const DEFAULT_AVATARS = [
  // Girls
  'https://api.dicebear.com/9.x/notionists/svg?seed=Sophia&backgroundColor=d97a5c',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Jasmine&backgroundColor=e08b70',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Luna&backgroundColor=e7b667',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Priya&backgroundColor=9e4b55',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Nora&backgroundColor=7f9486',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Zara&backgroundColor=b46e3c',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Chloe&backgroundColor=c28970',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Ava&backgroundColor=6b8a7a',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Meera&backgroundColor=506882',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Hana&backgroundColor=8b6b50',
  // Guys
  'https://api.dicebear.com/9.x/notionists/svg?seed=Felix&backgroundColor=416e55',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Leo&backgroundColor=5a698c',
  // Bearded guys
  'https://api.dicebear.com/9.x/notionists/svg?seed=Viking&backgroundColor=d97a5c',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Gandalf&backgroundColor=7f9486',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Beard&backgroundColor=e08b70',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Lumberjack&backgroundColor=9e4b55',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Sultan&backgroundColor=b46e3c',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Captain&backgroundColor=506882',
]

function getInitials(name?: string | null, email?: string) {
  const s = name || email || 'U'
  return s
    .split(' ')
    .map((t) => (t ? t[0] : ''))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function ProfileView() {
  const { user, refreshUser } = useAuthContext()
  const { showSnackbar } = useSnackbar()

  const [name, setName] = useState(user?.name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '')
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)

  const hasChanges =
    name.trim() !== (user?.name || '') || selectedAvatar !== (user?.avatar || '')

  const handleSave = async () => {
    if (!hasChanges) return

    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      if (name.trim() !== (user?.name || '')) payload.name = name.trim()
      if (selectedAvatar !== (user?.avatar || '')) payload.avatar = selectedAvatar

      await axiosInstance.patch('/api/profile', payload)
      await refreshUser()
      setEditingName(false)
      showSnackbar('Profile updated')
    } catch (err: any) {
      showSnackbar(err?.response?.data?.error || 'Failed to update profile', {
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const currentAvatar = selectedAvatar || user?.avatar

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-16 sm:px-6">
      <h1 className="text-2xl font-display font-semibold text-primary mb-8">Profile</h1>

      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
        {/* Current avatar + name */}
        <div className="flex items-center gap-5 mb-8">
          <div className="relative shrink-0">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover bg-secondary"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-2xl font-semibold text-primary">
                  {getInitials(user?.name, user?.email)}
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="max-w-[240px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingName(false)
                    if (e.key === 'Escape') {
                      setName(user?.name || '')
                      setEditingName(false)
                    }
                  }}
                />
                <button
                  onClick={() => setEditingName(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground truncate">
                  {name || user?.name || 'Unnamed'}
                </h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Avatar picker */}
        <div className="mb-8">
          <Label className="text-sm font-medium text-foreground mb-3 block">
            Choose an avatar
          </Label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {DEFAULT_AVATARS.map((url) => {
              const isSelected = selectedAvatar === url
              return (
                <button
                  key={url}
                  onClick={() => setSelectedAvatar(isSelected ? '' : url)}
                  className={`relative rounded-xl p-1.5 transition-all duration-150 ${
                    isSelected
                      ? 'bg-primary/15 ring-2 ring-primary'
                      : 'bg-secondary hover:bg-white/5'
                  }`}
                >
                  <img
                    src={url}
                    alt="Avatar option"
                    className="w-full aspect-square rounded-lg object-cover"
                  />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {selectedAvatar && (
            <button
              onClick={() => setSelectedAvatar('')}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Remove avatar
            </button>
          )}
        </div>

        {/* Info section */}
        <div className="border-t border-border pt-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm text-foreground">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined</p>
              <p className="text-sm text-foreground">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
