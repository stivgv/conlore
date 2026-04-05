import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Court, User } from '@/types/database'
import CourtCard from '@/components/CourtCard'
import DayScheduleCalendar from '@/components/DayScheduleCalendar'
import { type ScheduleBooking, type ScheduleCourt } from '@/components/GlobalScheduleGrid'
import QuickReleaseBanner from '@/components/ui/QuickReleaseBanner'
import AnalogReminderBanner from '@/components/ui/AnalogReminderBanner'
import { getSimulatedRole } from '@/lib/simulate'

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()

  // Auth check is already performed in the Dashboard layout — no need to repeat it here.
  // We still need getUser to fetch the profile for role/name display.
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const sp    = await searchParams
  const today = new Date().toLocaleDateString('en-CA')
  const date  = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today

  const [profileResult, courtsResult, bookingsResult] = await Promise.all([
    supabase
      .from('users')
      .select('role, name, email')
      .eq('id', authUser.id)
      .single<Pick<User, 'role' | 'name' | 'email'>>(),
    supabase
      .from('courts')
      .select('id, name, surface_type, is_active, open_time, close_time')
      .eq('is_active', true)
      .order('name')
      .returns<Court[]>(),
    supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time, booking_type, student_name, users(name, color_code)')
      .eq('status', 'confirmed')
      .gte('start_time', `${date}T00:00:00`)
      .lt('start_time',  `${offsetDate(date, 1)}T00:00:00`)
      .returns<ScheduleBooking[]>(),
  ])

  const profile     = profileResult.data
  const courts      = courtsResult.data  ?? []
  const bookings    = bookingsResult.data ?? []
  const isAdmin     = profile?.role === 'admin'

  // If admin is simulating a role, use that for UI rendering
  const simulatedRole = isAdmin ? await getSimulatedRole() : null
  const activeRole    = (simulatedRole ?? profile?.role ?? 'member') as 'admin' | 'member' | 'teacher'

  const displayName = profile?.name || profile?.email || authUser.email || 'Player'

  // Flatten teacher join data for ScheduleBooking
  const bookingsMapped = bookings.map((b: any) => ({
    id:            b.id,
    court_id:      b.court_id,
    start_time:    b.start_time,
    end_time:      b.end_time,
    booking_type:  b.booking_type ?? 'member',
    student_name:  b.student_name ?? null,
    teacher_name:  b.booking_type === 'teacher' ? (b.users?.name ?? null) : null,
    teacher_color: b.booking_type === 'teacher' ? (b.users?.color_code ?? null) : null,
  })) as ScheduleBooking[]

  const isTeacher = activeRole === 'teacher'

  // Active lesson for QuickReleaseBanner (teacher only)
  const now = new Date()
  const activeLesson = isTeacher
    ? (bookingsMapped.find(b =>
        b.booking_type === 'teacher' &&
        new Date(b.start_time) <= now &&
        new Date(b.end_time) > now
      ) ?? null)
    : null

  const todayLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())

  return (
    <main className="min-h-screen bg-white">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">

      {/* Hero */}
      <div className="mb-12 pb-8 border-b border-rg-dark/10">
        <p className="text-sm font-medium text-rg-clay mb-1">{todayLabel}</p>
        <h1 className="text-3xl font-bold text-rg-dark tracking-tight">
          Bentornato, {isAdmin && !simulatedRole ? 'Admin' : displayName} 👋
        </h1>
        <p className="text-rg-dark/50 mt-2 text-base">
          {courts.length > 0
            ? `${courts.length} camp${courts.length !== 1 ? 'i' : 'o'} disponibil${courts.length !== 1 ? 'i' : 'e'} — seleziona un campo per vedere gli orari e prenotare.`
            : 'Nessun campo disponibile al momento.'}
        </p>
      </div>

      {/* ── Master Cards ───────────────────────────────────────────────────── */}
      {courts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-rg-dark/8 flex items-center justify-center mb-4">
            <span className="text-3xl">🎾</span>
          </div>
          <p className="text-rg-dark/50 font-medium">Nessun campo attivo trovato.</p>
          {isAdmin && (
            <p className="text-sm text-rg-dark/35 mt-1">Aggiungi campi dal pannello Supabase.</p>
          )}
        </div>
      ) : (
        <div className="flex justify-center mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl justify-items-center">
            {courts.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        </div>
      )}

      {/* ── Overview section ───────────────────────────────────────────────── */}
      {courts.length > 0 && (
        <section>
          {isTeacher && (
            <div className="flex flex-col gap-3">
              <QuickReleaseBanner activeLesson={activeLesson ? {
                id: activeLesson.id,
                courtName: courts.find(c => c.id === activeLesson.court_id)?.name ?? 'Campo',
                studentName: activeLesson.student_name,
                startTime: activeLesson.start_time,
                endTime: activeLesson.end_time,
              } : null} />
              <AnalogReminderBanner />
            </div>
          )}
          <DayScheduleCalendar
            courts={courts as ScheduleCourt[]}
            bookings={bookingsMapped}
            date={date}
            today={today}
            userRole={activeRole}
          />
        </section>
      )}

    </div>
    </main>
  )
}
