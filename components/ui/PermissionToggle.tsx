'use client'

import { useState, useTransition } from 'react'
import { updateRolePermission } from '@/app/admin/impostazioni/actions'
import { Loader2 } from 'lucide-react'

interface PermissionToggleProps {
  role:       'member' | 'teacher'
  permission: string
  enabled:    boolean
}

/**
 * Toggle on/off per un singolo permesso di ruolo.
 * Esegue un optimistic update locale e chiama la server action `updateRolePermission`.
 * In caso di errore, ripristina lo stato precedente (rollback).
 */
export default function PermissionToggle({ role, permission, enabled: initialEnabled }: PermissionToggleProps) {
  const [enabled, setEnabled]        = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !enabled
    setEnabled(next) // optimistic update
    startTransition(async () => {
      const result = await updateRolePermission(role, permission, next)
      if (!result.ok) setEnabled(!next) // rollback on error
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={enabled ? 'Disabilita' : 'Abilita'}
      className="relative flex-shrink-0 focus:outline-none"
    >
      {isPending ? (
        <Loader2 size={14} className="animate-spin text-rg-dark/30" />
      ) : (
        <div
          className={[
            'w-11 h-6 rounded-full transition-colors duration-200',
            enabled ? 'bg-emerald-500' : 'bg-rg-dark/15',
          ].join(' ')}
        >
          <div
            className={[
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
              enabled ? 'translate-x-5' : 'translate-x-0.5',
            ].join(' ')}
          />
        </div>
      )}
    </button>
  )
}
