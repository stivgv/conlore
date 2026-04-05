'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, ChevronDown, X, Eye } from 'lucide-react'

interface UserOption {
  id:         string
  name:       string
  email:      string
  role:       string
  color_code: string | null
}

interface ProfileSimulatorProps {
  users:      UserOption[]
  /** The profile currently being simulated (null = viewing as self) */
  simulating: UserOption | null
}

const roleLabel: Record<string, string> = {
  admin:   'Admin',
  teacher: 'Maestro',
  member:  'Socio',
}

const rolePill: Record<string, string> = {
  admin:   'bg-amber-50 text-amber-700 border border-amber-200',
  teacher: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  member:  'bg-rg-dark/6 text-rg-dark/50 border border-rg-dark/10',
}

export default function ProfileSimulator({ users, simulating }: ProfileSimulatorProps) {
  const [open, setOpen]   = useState(false)
  const router            = useRouter()
  const ref               = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function simulate(user: UserOption) {
    const value = encodeURIComponent(JSON.stringify({
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      color_code: user.color_code,
    }))
    document.cookie = `tc_simulate=${value}; path=/; max-age=86400; SameSite=Lax`
    setOpen(false)
    router.refresh()
  }

  function exitSimulation() {
    document.cookie = 'tc_simulate=; path=/; max-age=0'
    setOpen(false)
    router.refresh()
  }

  const isSimulating = !!simulating

  // Group users by role for display
  const groups: { role: string; label: string; items: UserOption[] }[] = [
    { role: 'admin',   label: 'Admin',    items: users.filter(u => u.role === 'admin')   },
    { role: 'teacher', label: 'Maestri',  items: users.filter(u => u.role === 'teacher') },
    { role: 'member',  label: 'Soci',     items: users.filter(u => u.role === 'member')  },
  ].filter(g => g.items.length > 0)

  return (
    <div ref={ref} className="relative">

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={[
          'hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors',
          isSimulating
            ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
            : 'bg-rg-dark/5 text-rg-dark/50 border-rg-dark/12 hover:bg-rg-dark/10 hover:text-rg-dark',
        ].join(' ')}
      >
        {isSimulating ? (
          <>
            <Eye size={12} />
            <span className="max-w-[90px] truncate">{simulating.name || simulating.email}</span>
          </>
        ) : (
          <>
            <Users size={12} />
            <span>Simula</span>
          </>
        )}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-rg-dark/10 z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-rg-dark/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-rg-dark/40" />
              <span className="text-xs font-bold text-rg-dark/60 uppercase tracking-widest">Visualizza come</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-rg-dark/25 hover:text-rg-dark hover:bg-rg-dark/5"
            >
              <X size={12} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-2">

            {/* Exit simulation row */}
            {isSimulating && (
              <>
                <button
                  type="button"
                  onClick={exitSimulation}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-rg-dark/5 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-rg-clay/15 border border-rg-clay/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-rg-clay">✕</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-rg-clay">Esci dalla simulazione</span>
                    <span className="text-[10px] text-rg-dark/40">Torna alla tua vista Admin</span>
                  </div>
                </button>
                <div className="h-px bg-rg-dark/8 mx-4 my-1" />
              </>
            )}

            {/* User groups */}
            {groups.map(group => (
              <div key={group.role}>
                <p className="px-4 py-1.5 text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest">
                  {group.label}
                </p>
                {group.items.map(user => {
                  const isActive = simulating?.id === user.id
                  const letter   = (user.name || user.email).charAt(0).toUpperCase()
                  const color    = group.role === 'teacher' ? (user.color_code ?? '#6366f1') : undefined

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => simulate(user)}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                        isActive ? 'bg-violet-50' : 'hover:bg-rg-dark/5',
                      ].join(' ')}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${!color ? 'bg-rg-dark/8 text-rg-dark/60' : ''}`}
                        style={color
                          ? { backgroundColor: `${color}22`, border: `1px solid ${color}60`, color }
                          : undefined}
                      >
                        {letter}
                      </div>

                      {/* Info */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-rg-dark truncate">
                          {user.name || user.email}
                        </span>
                        {user.name && (
                          <span className="text-[10px] text-rg-dark/40 truncate">{user.email}</span>
                        )}
                      </div>

                      {/* Role pill */}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${rolePill[user.role] ?? rolePill.member}`}>
                        {roleLabel[user.role] ?? user.role}
                      </span>

                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
