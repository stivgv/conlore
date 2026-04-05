'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function memberCancelBooking(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // RLS ensures only the owner can update, but we also scope by user_id explicitly
  await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/my-bookings')
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

  const courtId  = formData.get('courtId')  as string
  const date     = formData.get('date')     as string
  const startTime = formData.get('startTime') as string
  const endTime   = formData.get('endTime')   as string

  if (!courtId || !date || !startTime || !endTime) {
    return { status: 'error', message: 'Please fill in all fields.' }
  }

  if (startTime >= endTime) {
    return { status: 'error', message: 'End time must be after start time.' }
  }

  const start    = `${date}T${startTime}:00`
  const end      = `${date}T${endTime}:00`
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

  const { error } = await supabase.from('bookings').insert({
    user_id:    user.id,
    court_id:   courtId,
    start_time: start,
    end_time:   end,
    status:     'confirmed',
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
