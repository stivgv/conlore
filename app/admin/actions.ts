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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Utente non trovato.' }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { status: 'error', message: 'Impossibile annullare la prenotazione. Riprova.' }

  // Audit trail: registra l'azione di cancellazione prenotazione
  await supabase.from('audit_log').insert({
    admin_id:    user.id,
    action:      'cancel_booking',
    entity_type: 'booking',
    entity_id:   bookingId,
    metadata:    { cancelled_at: new Date().toISOString() },
  })

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Utente non trovato.' }

  const { error } = await supabase
    .from('bookings')
    .update({ payment_status: status })
    .eq('id', bookingId)

  if (error) return { status: 'error', message: 'Impossibile aggiornare il pagamento. Riprova.' }

  // Audit trail: registra l'aggiornamento dello stato pagamento
  await supabase.from('audit_log').insert({
    admin_id:    user.id,
    action:      'update_payment_status',
    entity_type: 'booking',
    entity_id:   bookingId,
    metadata:    { new_status: status },
  })

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Utente non trovato.' }

  const { error } = await supabase
    .from('courts')
    .update({ is_active: !currentStatus })
    .eq('id', courtId)

  if (error) return { status: 'error', message: 'Impossibile aggiornare lo stato del campo. Riprova.' }

  // Audit trail: registra il cambio di stato del campo
  await supabase.from('audit_log').insert({
    admin_id:    user.id,
    action:      'toggle_court_status',
    entity_type: 'court',
    entity_id:   courtId,
    metadata:    { new_is_active: !currentStatus },
  })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { status: 'success', message: 'Stato del campo aggiornato.' }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcEndISO(date: string, startTime: string, durationHours: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const endMin = h * 60 + m + Math.round(durationHours * 60)
  const eH = String(Math.floor(endMin / 60)).padStart(2, '0')
  const eM = String(endMin % 60).padStart(2, '0')
  return `${date}T${eH}:${eM}:00`
}

async function checkOverlap(supabase: Awaited<ReturnType<typeof createClient>>, courtId: string, startISO: string, endISO: string): Promise<boolean> {
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('court_id', courtId)
    .eq('status', 'confirmed')
    .lt('start_time', endISO)
    .gt('end_time', startISO)
  return (data?.length ?? 0) > 0
}

// ─── Admin booking creation actions ──────────────────────────────────────────

/** Prenota uno slot per un socio registrato */
export async function adminBookForMember(
  courtId: string,
  date: string,
  startTime: string,
  durationHours: number,
  userId: string,
): Promise<AdminActionState> {
  const supabase = await requireAdmin()
  const { data: { user: admin } } = await supabase.auth.getUser()
  if (!admin) return { status: 'error', message: 'Utente non trovato.' }

  const startISO = `${date}T${startTime}:00`
  const endISO   = calcEndISO(date, startTime, durationHours)

  if (await checkOverlap(supabase, courtId, startISO, endISO))
    return { status: 'error', message: 'Slot già occupato. Scegli un altro orario.' }

  const { error } = await supabase.from('bookings').insert({
    user_id: userId, court_id: courtId,
    start_time: startISO, end_time: endISO,
    status: 'confirmed', booking_type: 'member',
  })
  if (error) return { status: 'error', message: 'Errore nella creazione della prenotazione.' }

  await supabase.from('audit_log').insert({
    admin_id: admin.id, action: 'admin_book_member', entity_type: 'booking', entity_id: courtId,
    metadata: { user_id: userId, start: startISO, end: endISO },
  })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { status: 'success', message: 'Prenotazione creata.' }
}

/** Prenota uno slot per un esterno (nome + telefono opzionale) */
export async function adminBookExternal(
  courtId: string,
  date: string,
  startTime: string,
  durationHours: number,
  name: string,
  phone: string,
): Promise<AdminActionState> {
  const supabase = await requireAdmin()
  const { data: { user: admin } } = await supabase.auth.getUser()
  if (!admin) return { status: 'error', message: 'Utente non trovato.' }

  const startISO   = `${date}T${startTime}:00`
  const endISO     = calcEndISO(date, startTime, durationHours)

  if (await checkOverlap(supabase, courtId, startISO, endISO))
    return { status: 'error', message: 'Slot già occupato.' }

  // Store phone in student_name using "|" as separator: "Name|phone"
  const storedName = phone.trim() ? `${name.trim()}|${phone.trim()}` : name.trim()

  const { error } = await supabase.from('bookings').insert({
    user_id: admin.id, court_id: courtId,
    start_time: startISO, end_time: endISO,
    status: 'confirmed', booking_type: 'member',
    student_name: storedName,
  })
  if (error) return { status: 'error', message: 'Errore nella creazione.' }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { status: 'success', message: 'Prenotazione esterna creata.' }
}

/** Crea una lezione maestro */
export async function adminBookLesson(
  courtId: string,
  date: string,
  startTime: string,
  durationHours: number,
  teacherId: string,
  studentName: string,
): Promise<AdminActionState> {
  const supabase = await requireAdmin()
  const { data: { user: admin } } = await supabase.auth.getUser()
  if (!admin) return { status: 'error', message: 'Utente non trovato.' }

  const startISO = `${date}T${startTime}:00`
  const endISO   = calcEndISO(date, startTime, durationHours)

  if (await checkOverlap(supabase, courtId, startISO, endISO))
    return { status: 'error', message: 'Slot già occupato.' }

  const { error } = await supabase.from('bookings').insert({
    user_id: teacherId, court_id: courtId,
    start_time: startISO, end_time: endISO,
    status: 'confirmed', booking_type: 'teacher',
    student_name: studentName.trim() || null,
  })
  if (error) return { status: 'error', message: 'Errore nella creazione della lezione.' }

  await supabase.from('audit_log').insert({
    admin_id: admin.id, action: 'admin_book_lesson', entity_type: 'booking', entity_id: courtId,
    metadata: { teacher_id: teacherId, student: studentName, start: startISO },
  })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/teacher')
  return { status: 'success', message: 'Lezione creata.' }
}
