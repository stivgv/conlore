'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type WeatherActionState = { status: 'success' | 'error'; message: string }

export type ActiveWeatherBlock = {
  id: string
  duration_type: '1h' | '3h' | 'end_of_day'
  block_until: string
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')
  return { supabase, userId: user.id }
}

/**
 * Computes the UTC timestamp when the block should expire.
 * For 'end_of_day', uses midnight Europe/Rome so the block auto-resets
 * at the turn of the day as the user requested.
 */
function computeBlockUntil(durationType: '1h' | '3h' | 'end_of_day'): Date {
  const now = new Date()

  if (durationType === '1h')  return new Date(now.getTime() +  3_600_000)
  if (durationType === '3h')  return new Date(now.getTime() + 10_800_000)

  // end_of_day: midnight Europe/Rome
  // 1. Find "today" in Rome
  const todayRome = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  // 2. Detect the current UTC offset of Rome (handles DST automatically)
  const romeLocal = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
  const offsetMs  = now.getTime() - romeLocal.getTime() // e.g. -7200000 for UTC+2
  // 3. "23:59:59 today Rome" parsed as server-local (UTC), then shifted
  const localMidnight = new Date(`${todayRome}T23:59:59`)
  return new Date(localMidnight.getTime() + offsetMs)
}

/** Returns the current active weather block, or null if none / expired. */
export async function getActiveWeatherBlock(): Promise<ActiveWeatherBlock | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('weather_blocks')
    .select('id, duration_type, block_until')
    .eq('is_active', true)
    .gt('block_until', new Date().toISOString())
    .maybeSingle()
  return data as ActiveWeatherBlock | null
}

/**
 * Activates a new weather block for the given duration.
 * Any previously active block is first deactivated.
 */
export async function activateWeatherBlock(
  durationType: '1h' | '3h' | 'end_of_day',
): Promise<WeatherActionState> {
  const { supabase, userId } = await requireAdmin()

  // Deactivate any existing active block
  await supabase
    .from('weather_blocks')
    .update({ is_active: false })
    .eq('is_active', true)

  const blockUntil = computeBlockUntil(durationType)

  const { error } = await supabase
    .from('weather_blocks')
    .insert({
      activated_by:  userId,
      duration_type: durationType,
      block_until:   blockUntil.toISOString(),
      is_active:     true,
    })

  if (error) return { status: 'error', message: 'Errore durante l\'attivazione. Riprova.' }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/schedule')
  return { status: 'success', message: 'Blocco maltempo attivato.' }
}

/** Immediately deactivates the current weather block (ripristino). */
export async function deactivateWeatherBlock(): Promise<WeatherActionState> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('weather_blocks')
    .update({ is_active: false })
    .eq('is_active', true)

  if (error) return { status: 'error', message: 'Errore durante il ripristino. Riprova.' }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/schedule')
  return { status: 'success', message: 'Ripristino completato. Prenotazioni riattivate.' }
}
