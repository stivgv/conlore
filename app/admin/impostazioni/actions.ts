'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** Verifies admin role — used as guard in every action. */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato.')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Accesso non autorizzato.')
  return supabase
}

/** Saves all role permissions in bulk (called by PermissionsEditor on explicit save). */
export async function saveAllPermissions(
  updates: { role: 'member' | 'teacher'; permission: string; enabled: boolean }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await requireAdmin()
    for (const { role, permission, enabled } of updates) {
      const { error } = await supabase
        .from('role_permissions')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('role', role)
        .eq('permission', permission)
      if (error) return { ok: false, error: error.message }
    }
    revalidatePath('/admin/impostazioni')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
