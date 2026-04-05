import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import PermissionsEditor from '@/components/ui/PermissionsEditor'

export default async function ImpostazioniPage() {
  const supabase = await createClient()

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('role, permission, enabled')

  // Build lookup: { member: { page_dashboard: true, ... }, teacher: { ... } }
  const lookup: Record<string, Record<string, boolean>> = {}
  for (const p of perms ?? []) {
    if (!lookup[p.role]) lookup[p.role] = {}
    lookup[p.role][p.permission] = p.enabled
  }

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10 pb-28">

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

      {/* Profili section — fully client-managed */}
      <section>
        <PermissionsEditor initialPermissions={lookup} />
      </section>
    </main>
  )
}
