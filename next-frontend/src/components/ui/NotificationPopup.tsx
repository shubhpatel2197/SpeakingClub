'use client'

import React, { useEffect, useRef } from 'react'
import { Bell, Check, X, UserPlus } from 'lucide-react'
import { useFriendRequests } from '../../hooks/useFriendRequests'

export default function NotificationPopup({
  open,
  onClose,
  triggerRef,
  mobile = false,
}: {
  open: boolean
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement | null>
  mobile?: boolean
}) {
  const { requests, count, fetchRequests, accept, reject } = useFriendRequests()
  const ref = useRef<HTMLDivElement>(null)

  // Fetch full request list when opened
  useEffect(() => {
    if (open) fetchRequests()
  }, [open, fetchRequests])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current && !ref.current.contains(target) &&
          !(triggerRef?.current && triggerRef.current.contains(target))) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={
        mobile
          ? "fixed inset-x-3 top-[4.5rem] z-[100] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#181B22] shadow-2xl sm:hidden"
          : "absolute right-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#181B22] shadow-2xl"
      }
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-sm font-semibold text-foreground">Notifications</span>
        {count > 0 && (
          <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
            {count}
          </span>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] mb-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                {req.avatar ? (
                  <img
                    src={req.avatar}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <UserPlus className="w-4 h-4 text-primary" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {req.name || 'Someone'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sent you a friend request
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => accept(req.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                  title="Accept"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => reject(req.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                  title="Reject"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
