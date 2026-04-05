'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  return supabase
}

export type AdminActionState = { status: 'success' | 'error'; message: string }

/**
 * Cancels any booking as an admin.
 * Returns a predictable state object instead of throwing so the caller
 * can surface feedback without an unhandled exception boundary.
 */
export async function adminCancelBooking(bookingId: string): Promise<AdminActionState> {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { status: 'error', message: 'Impossibile annullare la prenotazione. Riprova.' }

  revalidatePath('/admin')
  revalidatePath('/dashboard/my-bookings')
  revalidatePath('/dashboard')
  return { status: 'success', message: 'Prenotazione annullata.' }
}

/**
 * Updates the payment status of a booking (pending | paid | no_show).
 * Returns a predictable state object instead of throwing.
 */
export async function updatePaymentStatus(
  bookingId: string,
  status: 'pending' | 'paid' | 'no_show'
): Promise<AdminActionState> {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('bookings')
    .update({ payment_status: status })
    .eq('id', bookingId)

  if (error) return { status: 'error', message: 'Impossibile aggiornare il pagamento. Riprova.' }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { status: 'success', message: 'Stato pagamento aggiornato.' }
}

/**
 * Toggles the active/inactive state of a court.
 * Returns a predictable state object instead of throwing.
 */
export async function toggleCourtStatus(courtId: string, currentStatus: boolean): Promise<AdminActionState> {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('courts')
    .update({ is_active: !currentStatus })
    .eq('id', courtId)

  if (error) return { status: 'error', message: 'Impossibile aggiornare lo stato del campo. Riprova.' }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { status: 'success', message: 'Stato del campo aggiornato.' }
}
