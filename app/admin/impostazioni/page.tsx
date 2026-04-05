import { createClient } from '@/lib/supabase/server'
import { Settings, Users, Lock, Unlock } from 'lucide-react'
import PermissionToggle from '@/components/ui/PermissionToggle'

// All configurable permissions with display metadata
const PERMISSIONS = [
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

type PermissionKey = typeof PERMISSIONS[number]['key']

const ROLES = [
  { role: 'member'  as const, label: 'Socio',   color: 'rg-dark', pill: 'bg-rg-dark/6 text-rg-dark/60 border border-rg-dark/12' },
  { role: 'teacher' as const, label: 'Maestro',  color: 'indigo',  pill: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
]

export default async function ImpostazioniPage() {
  const supabase = await createClient()

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('role, permission, enabled')

  // Build a quick lookup: { member: { page_dashboard: true, ... }, teacher: { ... } }
  const lookup: Record<string, Record<string, boolean>> = {}
  for (const p of perms ?? []) {
    if (!lookup[p.role]) lookup[p.role] = {}
    lookup[p.role][p.permission] = p.enabled
  }

  // Group permissions by category
  const categories = [...new Set(PERMISSIONS.map(p => p.category))]

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10">

      {/* Header */}
      <div className="mb-10 pb-8 border-b border-rg-dark/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-rg-dark/8 flex items-center justify-center">
            <Settings size={18} className="text-rg-dark/50" />
          </div>
          <h1 className="text-3xl font-bold text-rg-dark tracking-tight">Impostazioni</h1>
        </div>
        <p className="text-rg-dark/50 mt-1">
          Configura le autorizzazioni per ogni tipologia di profilo.
        </p>
      </div>

      {/* Profili section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Users size={16} className="text-rg-dark/40" />
          <h2 className="text-lg font-bold text-rg-dark">Profili</h2>
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
                      const enabled = lookup[role]?.[perm.key] ?? false
                      return (
                        <div key={perm.key} className="flex items-center justify-between gap-4 px-6 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-emerald-50' : 'bg-rg-dark/5'}`}>
                              {enabled
                                ? <Unlock size={13} className="text-emerald-600" />
                                : <Lock   size={13} className="text-rg-dark/30" />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-rg-dark leading-snug">{perm.label}</p>
                              <p className="text-[11px] text-rg-dark/40 leading-snug mt-0.5">{perm.description}</p>
                            </div>
                          </div>
                          <PermissionToggle
                            role={role}
                            permission={perm.key}
                            enabled={enabled}
                          />
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
      </section>
    </main>
  )
}
