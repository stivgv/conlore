'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export type CancelBookingState = { status: 'success' | 'error'; message: string }

/**
 * Cancels a booking owned by the currently authenticated member.
 * Returns a predictable state object instead of void so the caller
 * can surface feedback to the user.
 */
export async function memberCancelBooking(bookingId: string): Promise<CancelBookingState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Non autenticato.' }

  // RLS ensures only the owner can update, but we also scope by user_id explicitly
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id)

  if (error) return { status: 'error', message: 'Impossibile annullare la prenotazione. Riprova.' }

  revalidatePath('/dashboard/my-bookings')
  return { status: 'success', message: 'Prenotazione annullata.' }
}

export type BookingState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success' }

export async function createBooking(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'You must be logged in to book a court.' }

  // Use optional chaining + nullish coalescing instead of unsafe `as string` cast
  const courtId   = formData.get('courtId')?.toString()   ?? ''
  const date      = formData.get('date')?.toString()      ?? ''
  const startTime = formData.get('startTime')?.toString() ?? ''
  const endTime   = formData.get('endTime')?.toString()   ?? ''

  if (!courtId || !date || !startTime || !endTime) {
    return { status: 'error', message: 'Please fill in all fields.' }
  }

  if (startTime >= endTime) {
    return { status: 'error', message: 'End time must be after start time.' }
  }

  // Append UTC offset to avoid ambiguous local-time parsing
  const start    = `${date}T${startTime}:00+00:00`
  const end      = `${date}T${endTime}:00+00:00`
  const startMs  = new Date(start).getTime()
  const endMs    = new Date(end).getTime()

  // Past booking check
  if (startMs < Date.now()) {
    return { status: 'error', message: 'You cannot book a court in the past.' }
  }

  // Duration check (60–120 minutes)
  const durationMinutes = (endMs - startMs) / 60_000
  if (durationMinutes < 60 || durationMinutes > 120) {
    return { status: 'error', message: 'Bookings must be between 1 and 2 hours long.' }
  }

  // User ubiquity check — confirmed booking already overlapping this window
  const { data: overlapping } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .lt('start_time', end)    // existing booking starts before new end
    .gt('end_time', start)    // existing booking ends after new start
    .limit(1)

  if (overlapping && overlapping.length > 0) {
    return { status: 'error', message: 'You already have a booking during this time slot.' }
  }

  // Calculate price server-side: 20€/hour, rounded to nearest euro
  const totalPrice = Math.round((durationMinutes / 60) * 20)

  const { error } = await supabase.from('bookings').insert({
    user_id:     user.id,
    court_id:    courtId,
    start_time:  start,
    end_time:    end,
    status:      'confirmed',
    total_price: totalPrice,
  })

  if (error) {
    // 23P01 = exclusion constraint violation (our no_overlap GIST)
    if (error.code === '23P01') {
      return { status: 'error', message: 'This court is already booked for this time slot.' }
    }
    return { status: 'error', message: 'Booking failed. Please try again.' }
  }

  revalidatePath('/dashboard')
  return { status: 'success' }
}
