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

export async function adminCancelBooking(bookingId: string) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/dashboard/my-bookings')
}

export async function updatePaymentStatus(bookingId: string, status: 'pending' | 'paid' | 'no_show') {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('bookings')
    .update({ payment_status: status })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
}

export async function toggleCourtStatus(courtId: string, currentStatus: boolean) {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('courts')
    .update({ is_active: !currentStatus })
    .eq('id', courtId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/dashboard')
}
