'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ChevronDown, X } from 'lucide-react'

type SimulableRole = 'member' | 'teacher'

interface ProfileSimulatorProps {
  /** The role currently being simulated (null = viewing as self/admin) */
  simulatingRole: SimulableRole | null
}

const ROLE_OPTIONS: { role: SimulableRole; label: string; description: string; pill: string }[] = [
  {
    role:        'member',
    label:       'Socio',
    description: 'Vista prenotazione campi standard',
    pill:        'bg-rg-dark/6 text-rg-dark/60 border border-rg-dark/12',
  },
  {
    role:        'teacher',
    label:       'Maestro',
    description: 'Vista con prenotazione lezioni',
    pill:        'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
]

/**
 * Dropdown che consente all'admin di simulare la vista di un ruolo (Socio o Maestro).
 * Scrive il cookie `tc_simulate` con `{ role }` e fa refresh della pagina.
 * Non effettua fetch al DB: opera solo sul cookie lato client.
 */
export default function ProfileSimulator({ simulatingRole }: ProfileSimulatorProps) {
  const [open, setOpen] = useState(false)
  const router          = useRouter()
  const ref             = useRef<HTMLDivElement>(null)

  // Chiude il dropdown al click esterno
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /** Imposta il cookie di simulazione per il ruolo scelto e aggiorna la pagina */
  function simulate(role: SimulableRole) {
    const value = encodeURIComponent(JSON.stringify({ role }))
    document.cookie = `tc_simulate=${value}; path=/; max-age=86400; SameSite=Lax`
    setOpen(false)
    router.refresh()
  }

  /** Rimuove il cookie di simulazione e torna alla vista Admin */
  function exitSimulation() {
    document.cookie = 'tc_simulate=; path=/; max-age=0'
    setOpen(false)
    router.refresh()
  }

  const currentOption = ROLE_OPTIONS.find(o => o.role === simulatingRole)

  return (
    <div ref={ref} className="relative">

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={[
          'hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors',
          simulatingRole
            ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
            : 'bg-rg-dark/5 text-rg-dark/50 border-rg-dark/12 hover:bg-rg-dark/10 hover:text-rg-dark',
        ].join(' ')}
      >
        <Eye size={12} />
        <span>{simulatingRole ? currentOption?.label : 'Simula'}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-rg-dark/10 z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-rg-dark/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={13} className="text-rg-dark/40" />
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

          <div className="py-2">

            {/* Exit option (quando si sta simulando) */}
            {simulatingRole && (
              <>
                <button
                  type="button"
                  onClick={exitSimulation}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-rg-dark/5 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-rg-clay/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-rg-clay">✕</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-rg-clay">Esci dalla simulazione</span>
                    <span className="text-[10px] text-rg-dark/40">Torna alla vista Admin</span>
                  </div>
                </button>
                <div className="h-px bg-rg-dark/8 mx-4 my-1" />
              </>
            )}

            {/* Opzioni di ruolo */}
            {ROLE_OPTIONS.map(option => {
              const isActive = simulatingRole === option.role
              return (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => simulate(option.role)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                    isActive ? 'bg-violet-50' : 'hover:bg-rg-dark/5',
                  ].join(' ')}
                >
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${option.pill}`}>
                    {option.label}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-rg-dark/50 leading-snug">{option.description}</span>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0 ml-auto" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
