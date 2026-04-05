'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Lock, Unlock, Save, CheckCircle2, AlertTriangle,
  Loader2, X, LogOut,
} from 'lucide-react'
import { saveAllPermissions } from '@/app/admin/impostazioni/actions'

// ── Config ────────────────────────────────────────────────────────────────────

export const PERMISSIONS = [
  {
    key:         'page_dashboard',
    label:       'Dashboard (Campi)',
    description: 'Accesso alla pagina principale con i campi e il calendario',
    category:    'Pagine',
  },
  {
    key:         'page_schedule',
    label:       'Orario Generale',
    description: 'Visualizzazione della pagina orario con tutti i campi',
    category:    'Pagine',
  },
  {
    key:         'page_my_bookings',
    label:       'Le Mie Prenotazioni',
    description: 'Accesso alla pagina con le prenotazioni personali',
    category:    'Pagine',
  },
  {
    key:         'book_courts',
    label:       'Prenotazione Campi',
    description: 'Possibilità di prenotare uno slot orario su un campo',
    category:    'Funzionalità',
  },
  {
    key:         'cancel_bookings',
    label:       'Cancellazione Prenotazioni',
    description: 'Possibilità di annullare le proprie prenotazioni',
    category:    'Funzionalità',
  },
  {
    key:         'teacher_lessons',
    label:       'Lezioni Maestro',
    description: 'Registrazione lezioni con nome allievo (solo Maestri)',
    category:    'Funzionalità',
  },
] as const

export const ROLES = [
  {
    role:  'member'  as const,
    label: 'Socio',
    pill:  'bg-rg-dark/6 text-rg-dark/60 border border-rg-dark/12',
  },
  {
    role:  'teacher' as const,
    label: 'Maestro',
    pill:  'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type PermLookup = Record<string, Record<string, boolean>>

interface PermissionsEditorProps {
  initialPermissions: PermLookup
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PermissionsEditor({ initialPermissions }: PermissionsEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Working state (local, unsaved)
  const [permissions, setPermissions] = useState<PermLookup>(initialPermissions)
  // Last persisted state
  const [savedPermissions, setSavedPermissions] = useState<PermLookup>(initialPermissions)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Navigation guard state
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // ── Derived state ───────────────────────────────────────────────────────────
  const hasUnsaved = JSON.stringify(permissions) !== JSON.stringify(savedPermissions)

  const categories = [...new Set(PERMISSIONS.map(p => p.category))]

  // ── Navigation guard — browser close / refresh ──────────────────────────────
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!hasUnsaved) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  // ── Navigation guard — in-app link clicks (capture phase) ───────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!hasUnsaved) return
      const anchor = (e.target as Element).closest('a')
      if (!anchor?.href) return
      let url: URL
      try { url = new URL(anchor.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(url.pathname + url.search)
      setShowUnsavedModal(true)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [hasUnsaved])

  // ── Toggle ──────────────────────────────────────────────────────────────────
  function toggle(role: string, permKey: string) {
    setPermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [permKey]: !prev[role]?.[permKey] },
    }))
    setSaveError(null)
    setJustSaved(false)
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function handleSave() {
    const updates: { role: 'member' | 'teacher'; permission: string; enabled: boolean }[] = []
    for (const { role } of ROLES) {
      for (const [perm, enabled] of Object.entries(permissions[role] ?? {})) {
        updates.push({ role, permission: perm, enabled })
      }
    }
    startTransition(async () => {
      const result = await saveAllPermissions(updates)
      if (result.ok) {
        setSavedPermissions(permissions)
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2500)
      } else {
        setSaveError(result.error ?? 'Errore durante il salvataggio.')
      }
    })
  }

  // ── Discard ─────────────────────────────────────────────────────────────────
  function handleDiscard() {
    setPermissions(savedPermissions)
    setSaveError(null)
    setJustSaved(false)
  }

  // ── Confirm leave ───────────────────────────────────────────────────────────
  function confirmLeave() {
    setShowUnsavedModal(false)
    if (pendingHref) {
      router.push(pendingHref)
      setPendingHref(null)
    }
  }

  function cancelLeave() {
    setShowUnsavedModal(false)
    setPendingHref(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Section header with badge */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-rg-dark">Profili</span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {justSaved ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={12} />
              Salvato
            </span>
          ) : hasUnsaved ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle size={12} />
              Modifiche da salvare
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-rg-dark/5 text-rg-dark/40 border border-rg-dark/8">
              <CheckCircle2 size={12} />
              Tutto salvato
            </span>
          )}
        </div>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ROLES.map(({ role, label, pill }) => (
          <div
            key={role}
            className="bg-white rounded-2xl border border-rg-dark/10 shadow-sm overflow-hidden"
          >
            {/* Card header */}
            <div className="px-6 py-4 border-b border-rg-dark/8 flex items-center gap-3" style={{ background: '#31181508' }}>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pill}`}>
                {label}
              </span>
              <span className="text-xs text-rg-dark/40 font-medium">
                Autorizzazioni del profilo
              </span>
            </div>

            {/* Permissions list */}
            <div className="divide-y divide-rg-dark/6">
              {categories.map(category => (
                <div key={category}>
                  <p className="px-6 py-2.5 text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest bg-rg-dark/[0.02]">
                    {category}
                  </p>
                  {PERMISSIONS.filter(p => p.category === category).map(perm => {
                    const enabled = permissions[role]?.[perm.key] ?? false
                    const wasSaved = savedPermissions[role]?.[perm.key] ?? false
                    const isDirty  = enabled !== wasSaved

                    return (
                      <div
                        key={perm.key}
                        className={`flex items-center justify-between gap-4 px-6 py-3.5 transition-colors ${isDirty ? 'bg-amber-50/50' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-emerald-50' : 'bg-rg-dark/5'}`}>
                            {enabled
                              ? <Unlock size={13} className="text-emerald-600" />
                              : <Lock   size={13} className="text-rg-dark/30" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-rg-dark leading-snug">
                              {perm.label}
                              {isDirty && (
                                <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                  modificato
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-rg-dark/40 leading-snug mt-0.5">{perm.description}</p>
                          </div>
                        </div>

                        {/* Inline toggle */}
                        <button
                          type="button"
                          onClick={() => toggle(role, perm.key)}
                          aria-label={enabled ? 'Disabilita' : 'Abilita'}
                          className="relative flex-shrink-0 focus:outline-none"
                        >
                          <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-emerald-500' : 'bg-rg-dark/15'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Admin notice */}
      <div className="mt-6 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-50 border border-amber-200">
        <span className="text-base flex-shrink-0 mt-0.5">⚙️</span>
        <p className="text-sm text-amber-800 leading-snug">
          <span className="font-bold">Admin</span>: Dispone sempre di tutti i permessi. Le impostazioni di questa pagina non si applicano al profilo Admin.
        </p>
      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-out ${
          hasUnsaved ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="border-t border-rg-dark/10 bg-white/95 backdrop-blur-md shadow-lg">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">

            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm font-medium text-rg-dark/70">
                Hai <span className="font-bold text-rg-dark">modifiche non salvate</span> alle autorizzazioni.
              </span>
              {saveError && (
                <span className="text-xs text-red-600 font-medium">— {saveError}</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-rg-dark/50 border border-rg-dark/12 hover:bg-rg-dark/5 transition-colors disabled:opacity-40"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-rg-clay hover:bg-rg-dark transition-colors disabled:opacity-50"
              >
                {isPending
                  ? <><Loader2 size={14} className="animate-spin" />Salvataggio…</>
                  : <><Save size={14} />Salva impostazioni</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Unsaved changes modal ────────────────────────────────────────────── */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rg-dark/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-rg-dark">Modifiche non salvate</h3>
              </div>
              <button
                type="button"
                onClick={cancelLeave}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-rg-dark/25 hover:text-rg-dark hover:bg-rg-dark/5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5">
              <p className="text-sm text-rg-dark/65 leading-relaxed">
                Stai per uscire dalla pagina <span className="font-semibold text-rg-dark">Impostazioni</span> senza salvare le modifiche alle autorizzazioni dei profili.
              </p>
              <p className="text-sm text-rg-dark/65 mt-2">
                Le modifiche andranno perse.
              </p>
            </div>

            {/* Modal actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                type="button"
                onClick={cancelLeave}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-rg-dark/60 border border-rg-dark/12 hover:bg-rg-dark/5 transition-colors"
              >
                Rimani
              </button>
              <button
                type="button"
                onClick={confirmLeave}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-rg-dark hover:bg-rg-clay transition-colors"
              >
                <LogOut size={13} />
                Esci senza salvare
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
