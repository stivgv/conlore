import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSimulatedRole } from '@/lib/simulate'
import { type ScheduleBooking, type ScheduleCourt } from '@/components/GlobalScheduleGrid'
import TeacherWeeklyCalendar from '@/components/TeacherWeeklyCalendar'
import { GraduationCap, CalendarDays, Clock, Users } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

/** Extends ScheduleBooking with user_id to distinguish "my lesson" from other bookings */
type WeekBooking = ScheduleBooking & { user_id: string }

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns the Monday of the current week as YYYY-MM-DD. */
function getCurrentMonday(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toLocaleDateString('en-CA')
}

/** Returns a date string offset by `days` from a YYYY-MM-DD string. */
function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

/** Returns true if the string is a valid YYYY-MM-DD date. */
function isValidDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str))
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()

  // ── Auth + role check ──────────────────────────────────────────────────
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, email, color_code')
    .eq('id', authUser.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const simulatedRole = isAdmin ? await getSimulatedRole() : null
  const activeRole = simulatedRole ?? profile?.role

  // Only teachers (or admins simulating teacher) can access this page
  if (activeRole !== 'teacher') redirect('/dashboard')

  // ── Week navigation from searchParams ─────────────────────────────────
  const sp = await searchParams
  const rawWeek = sp.week ?? ''

  // Validate and default to current Monday if absent or invalid
  const weekStart: string =
    isValidDate(rawWeek) ? rawWeek : getCurrentMonday()

  // weekEnd is the exclusive upper bound (next Monday)
  const weekEnd = offsetDate(weekStart, 7)

  // ── Date setup ─────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-CA')
  const firstOfMonth = `${today.slice(0, 7)}-01`
  const firstOfNextMonth = (() => {
    const [y, m] = today.split('-').map(Number)
    // m (not m-1) advances to the next month
    return new Date(y, m, 1).toLocaleDateString('en-CA')
  })()

  // ── Parallel queries ───────────────────────────────────────────────────
  const [courtsResult, weekBookingsResult, monthResult] = await Promise.all([
    // 1. All active courts
    supabase
      .from('courts')
      .select('id, name, open_time, close_time')
      .eq('is_active', true)
      .order('name')
      .returns<ScheduleCourt[]>(),

    // 2. ALL confirmed bookings for the week across ALL courts
    // (needed to show "Occupied" slots from other users)
    supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time, booking_type, student_name, user_id, users(name, color_code)')
      .eq('status', 'confirmed')
      .gte('start_time', `${weekStart}T00:00:00`)
      .lt('start_time', `${weekEnd}T00:00:00`)
      .returns<any[]>(),

    // 3. Monthly stats (only the teacher's own lessons)
    supabase
      .from('bookings')
      .select('id, start_time, student_name')
      .eq('user_id', authUser.id)
      .eq('booking_type', 'teacher')
      .eq('status', 'confirmed')
      .gte('start_time', `${firstOfMonth}T00:00:00`)
      .lt('start_time', `${firstOfNextMonth}T00:00:00`),
  ])

  // ── Map raw bookings to WeekBooking[] ──────────────────────────────────
  const weekBookings: WeekBooking[] = (weekBookingsResult.data ?? []).map((b: any) => ({
    id:            b.id,
    court_id:      b.court_id,
    start_time:    b.start_time,
    end_time:      b.end_time,
    booking_type:  b.booking_type ?? 'member',
    student_name:  b.student_name ?? null,
    teacher_name:  b.booking_type === 'teacher' ? (b.users?.name ?? null) : null,
    teacher_color: b.booking_type === 'teacher' ? (b.users?.color_code ?? null) : null,
    user_id:       b.user_id,
  }))

  // ── Courts ─────────────────────────────────────────────────────────────
  const courts = courtsResult.data ?? []

  // ── Computed monthly stats ─────────────────────────────────────────────
  const monthLessons = monthResult.data ?? []
  const monthCount = monthLessons.length
  // Each lesson counts as 1 hour
  const monthHours = monthCount
  const uniqueStudents = [
    ...new Set(monthLessons.map((b: any) => b.student_name).filter(Boolean)),
  ]

  // Lessons the teacher has today (only if this week includes today)
  const todayLessonsCount =
    weekStart <= today && today < weekEnd
      ? weekBookings.filter(
          (b) => b.user_id === authUser.id && b.start_time.startsWith(today)
        ).length
      : 0

  // ── Display helpers ────────────────────────────────────────────────────
  const displayName =
    profile?.name || profile?.email || authUser.email || 'Maestro'
  const teacherColor: string = (profile?.color_code as string | null) ?? '#6366f1'

  // ── JSX ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">

        {/* ── 1. Header ───────────────────────────────────────────────── */}
        <div className="mb-8 pb-6 border-b border-rg-dark/10">
          <p className="text-sm font-medium text-rg-clay mb-1">Dashboard Maestro</p>
          <h1 className="text-3xl font-bold text-rg-dark tracking-tight">
            Bentornato, {displayName} 👋
          </h1>
        </div>

        {/* ── 2. Stats bar ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 pb-8 border-b border-rg-dark/10">

          {/* Oggi */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <GraduationCap size={14} className="text-rg-clay" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">
                Oggi
              </span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{todayLessonsCount}</span>
            <span className="text-xs text-rg-dark/40">
              {todayLessonsCount === 1 ? 'lezione' : 'lezioni'}
            </span>
          </div>

          {/* Mese */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarDays size={14} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">
                Mese
              </span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{monthCount}</span>
            <span className="text-xs text-rg-dark/40">
              {monthCount === 1 ? 'lezione' : 'lezioni'}
            </span>
          </div>

          {/* Ore */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={14} className="text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">
                Ore
              </span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{monthHours}</span>
            <span className="text-xs text-rg-dark/40">ore insegnate</span>
          </div>

          {/* Allievi */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">
                Allievi
              </span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{uniqueStudents.length}</span>
            <span className="text-xs text-rg-dark/40">
              {uniqueStudents.length === 1 ? 'allievo' : 'allievi'}
            </span>
          </div>
        </div>

        {/* ── 3. Weekly calendar ───────────────────────────────────────── */}
        <div className="w-[80%] mx-auto">
          <TeacherWeeklyCalendar
            courts={courts}
            bookings={weekBookings}
            weekStart={weekStart}
            today={today}
            teacherId={authUser.id}
            teacherName={displayName}
            teacherColor={teacherColor}
          />
        </div>

      </div>
    </main>
  )
}
