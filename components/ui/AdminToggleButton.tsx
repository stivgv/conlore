'use client'

import { useTransition } from 'react'
import { toggleCourtStatus } from '@/app/admin/actions'
import { Loader2 } from 'lucide-react'

export default function AdminToggleButton({ courtId, isActive }: { courtId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => toggleCourtStatus(courtId, isActive))}
      disabled={isPending}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
      }`}
      title={isActive ? 'Click to deactivate' : 'Click to activate'}
    >
      {isPending ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      )}
      {isPending ? 'Updating…' : isActive ? 'Active' : 'Inactive'}
    </button>
  )
}
