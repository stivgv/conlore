'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PRICING } from '@/lib/config/pricing'

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

  // Leggi la prenotazione per verificare start_time
  const { data: booking } = await supabase
    .from('bookings')
    .select('start_time')
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .single()

  if (!booking) {
    return { status: 'error', message: 'Prenotazione non trovata.' }
  }

  const hoursUntil = (new Date(booking.start_time).getTime() - Date.now()) / 3_600_000
  if (hoursUntil < 24) {
    return { status: 'error', message: 'Non è possibile annullare una prenotazione nelle 24 ore precedenti.' }
  }

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

  // Calculate price server-side using centralized pricing config, rounded to nearest euro
  const totalPrice = Math.round((durationMinutes / 60) * PRICING.PER_HOUR)

  // Atomic overlap-check + INSERT via stored procedure to prevent TOCTOU race conditions
  const { error } = await supabase.rpc('create_booking_safe', {
    p_court_id:    courtId,
    p_user_id:     user.id,
    p_start_time:  start,
    p_end_time:    end,
    p_total_price: totalPrice,
  })

  if (error) {
    console.error('[createBooking] RPC error:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
    if (error.message.includes('COURT_OVERLAP') || error.code === '23P01') {
      return { status: 'error', message: 'Il campo è già occupato in questo orario.' }
    }
    if (error.message.includes('USER_OVERLAP') || error.code === '23514') {
      return { status: 'error', message: 'Hai già una prenotazione in questo orario.' }
    }
    if (error.code === '42883') {
      return { status: 'error', message: 'Errore di configurazione del server. Contatta l\'amministratore.' }
    }
    return { status: 'error', message: `Prenotazione fallita (${error.code ?? 'ERR'}). Riprova.` }
  }

  revalidatePath('/dashboard')
  return { status: 'success' }
}

export async function createTeacherBooking(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Non autenticato.' }

  // Verify teacher role server-side
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    return { status: 'error', message: 'Accesso non autorizzato.' }
  }

  const courtId     = formData.get('courtId')?.toString()     ?? ''
  const date        = formData.get('date')?.toString()        ?? ''
  const startTime   = formData.get('startTime')?.toString()   ?? ''
  const endTime     = formData.get('endTime')?.toString()     ?? ''
  const studentName = formData.get('studentName')?.toString()?.trim() ?? ''

  if (!courtId || !date || !startTime || !endTime || !studentName) {
    return { status: 'error', message: 'Compila tutti i campi.' }
  }

  const start = `${date}T${startTime}:00+00:00`
  const end   = `${date}T${endTime}:00+00:00`

  if (new Date(start).getTime() < Date.now()) {
    return { status: 'error', message: 'Non puoi prenotare nel passato.' }
  }

  const { error } = await supabase.rpc('create_teacher_booking', {
    p_court_id:     courtId,
    p_teacher_id:   user.id,
    p_start_time:   start,
    p_end_time:     end,
    p_student_name: studentName,
  })

  if (error) {
    console.error('[createTeacherBooking] RPC error:', { code: error.code, message: error.message })
    if (error.message.includes('TEACHER_OVERLAP') || error.code === '23514') {
      return { status: 'error', message: 'Hai già una lezione programmata in questo orario su un altro campo.' }
    }
    if (error.message.includes('COURT_OVERLAP') || error.code === '23P01') {
      return { status: 'error', message: 'Il campo è già occupato in questo orario.' }
    }
    return { status: 'error', message: `Prenotazione fallita. Riprova.` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/teacher')
  return { status: 'success' }
}

export async function teacherCancelBooking(bookingId: string): Promise<CancelBookingState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Non autenticato.' }

  // Verify teacher role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    return { status: 'error', message: 'Accesso non autorizzato.' }
  }

  // No 24h restriction for teachers — cancel at any time
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .eq('booking_type', 'teacher')

  if (error) return { status: 'error', message: 'Impossibile annullare la lezione. Riprova.' }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/my-bookings')
  revalidatePath('/dashboard/teacher')
  return { status: 'success', message: 'Lezione annullata.' }
}
