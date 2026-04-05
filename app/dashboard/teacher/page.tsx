import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSimulatedRole } from '@/lib/simulate'
import {
  GraduationCap,
  Clock,
  Users,
  CalendarDays,
  BarChart3,
  BookOpen,
  ChevronRight,
  Zap,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

type LessonBooking = {
  id: string
  court_id: string
  start_time: string
  end_time: string
  status: string
  student_name: string | null
  courts: { name: string; surface_type: string } | null
}

type MonthLesson = {
  id: string
  start_time: string
  end_time: string
  student_name: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Formats an ISO datetime string to HH:MM (Italian locale). */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/** Returns a date string offset by `days` from a YYYY-MM-DD string. */
function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

/** Groups an array of lessons by their calendar date (YYYY-MM-DD). */
function groupByDate(lessons: LessonBooking[]): Map<string, LessonBooking[]> {
  const map = new Map<string, LessonBooking[]>()
  for (const lesson of lessons) {
    const key = lesson.start_time.slice(0, 10)
    const existing = map.get(key) ?? []
    existing.push(lesson)
    map.set(key, existing)
  }
  return map
}

/** Formats a YYYY-MM-DD string to a human-readable Italian date (e.g. "Lunedì 7 Aprile"). */
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, d))
}

/** Capitalizes the first character of a string. */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function TeacherDashboardPage() {
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

  // ── Date setup ─────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-CA')
  const tomorrow = offsetDate(today, 1)
  const in8Days = offsetDate(today, 8)
  const firstOfMonth = `${today.slice(0, 7)}-01`
  const firstOfNextMonth = (() => {
    const [y, m] = today.split('-').map(Number)
    // m (not m-1) advances to the next month
    return new Date(y, m, 1).toLocaleDateString('en-CA')
  })()

  // ── Parallel queries ───────────────────────────────────────────────────
  const [todayResult, upcomingResult, monthResult] = await Promise.all([
    // Today's lessons
    supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time, status, student_name, courts(name, surface_type)')
      .eq('user_id', authUser.id)
      .eq('booking_type', 'teacher')
      .eq('status', 'confirmed')
      .gte('start_time', `${today}T00:00:00`)
      .lt('start_time', `${tomorrow}T00:00:00`)
      .order('start_time')
      .returns<LessonBooking[]>(),

    // Upcoming lessons (tomorrow + 7 days)
    supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time, status, student_name, courts(name, surface_type)')
      .eq('user_id', authUser.id)
      .eq('booking_type', 'teacher')
      .eq('status', 'confirmed')
      .gte('start_time', `${tomorrow}T00:00:00`)
      .lt('start_time', `${in8Days}T00:00:00`)
      .order('start_time')
      .returns<LessonBooking[]>(),

    // Current month stats
    supabase
      .from('bookings')
      .select('id, start_time, end_time, student_name')
      .eq('user_id', authUser.id)
      .eq('booking_type', 'teacher')
      .eq('status', 'confirmed')
      .gte('start_time', `${firstOfMonth}T00:00:00`)
      .lt('start_time', `${firstOfNextMonth}T00:00:00`)
      .returns<MonthLesson[]>(),
  ])

  const todayLessons = todayResult.data ?? []
  const upcomingLessons = upcomingResult.data ?? []
  const monthLessons = monthResult.data ?? []

  // ── Computed stats ─────────────────────────────────────────────────────
  const monthCount = monthLessons.length
  // Each lesson is 60 min = 1 hour
  const monthHours = monthCount

  const uniqueStudents = [...new Set(monthLessons.map((b) => b.student_name).filter(Boolean))]

  const studentCounts = monthLessons.reduce<Record<string, number>>((acc, b) => {
    if (b.student_name) acc[b.student_name] = (acc[b.student_name] ?? 0) + 1
    return acc
  }, {})

  const topStudent =
    Object.entries(studentCounts).sort((a, b) => b[1] - a[1])[0] ?? null

  // Active lesson: start <= now < end
  const now = new Date()
  const activeLesson =
    todayLessons.find(
      (b) => new Date(b.start_time) <= now && new Date(b.end_time) > now
    ) ?? null

  // Display data
  const displayName =
    profile?.name || profile?.email || authUser.email || 'Maestro'

  const avatarColor: string = (profile?.color_code as string | null | undefined) ?? '#6366f1'

  const todayLabelFull = capitalize(
    new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  )

  // Group upcoming lessons by date
  const upcomingByDate = groupByDate(upcomingLessons)

  // ── JSX ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">

        {/* ── 1. Header ───────────────────────────────────────────────── */}
        <div className="mb-10 pb-8 border-b border-rg-dark/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-sm"
              style={{ backgroundColor: avatarColor }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-rg-dark tracking-tight">
                Bentornato, {displayName} 👋
              </h1>
              <p className="text-rg-dark/50 mt-1 text-sm">
                La tua dashboard — {todayLabelFull}
              </p>
            </div>
          </div>

          {/* Active lesson pill */}
          {activeLesson && (
            <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              🎾 In corso —{' '}
              {activeLesson.student_name ?? 'Allievo'} su{' '}
              {activeLesson.courts?.name ?? 'Campo'}
            </div>
          )}
        </div>

        {/* ── 2. Stats bar ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 pb-8 border-b border-rg-dark/10">
          {/* Oggi */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-rg-clay mb-1">
              <Zap size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">Oggi</span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{todayLessons.length}</span>
            <span className="text-xs text-rg-dark/40">
              {todayLessons.length === 1 ? 'lezione' : 'lezioni'}
            </span>
          </div>

          {/* Questo mese — lezioni */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarDays size={14} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">Mese</span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{monthCount}</span>
            <span className="text-xs text-rg-dark/40">
              {monthCount === 1 ? 'lezione' : 'lezioni'}
            </span>
          </div>

          {/* Ore insegnate */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={14} className="text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">Ore</span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{monthHours}</span>
            <span className="text-xs text-rg-dark/40">ore insegnate</span>
          </div>

          {/* Allievi */}
          <div className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rg-dark/40">Allievi</span>
            </div>
            <span className="text-3xl font-extrabold text-rg-dark">{uniqueStudents.length}</span>
            <span className="text-xs text-rg-dark/40">
              {uniqueStudents.length === 1 ? 'allievo' : 'allievi'}
            </span>
          </div>
        </div>

        {/* ── 3. Lezioni di oggi ───────────────────────────────────────── */}
        <section className="mb-10 pb-8 border-b border-rg-dark/10">
          <div className="flex items-center gap-2 mb-5">
            <GraduationCap size={18} className="text-rg-clay" />
            <h2 className="text-lg font-bold text-rg-dark">Lezioni di oggi</h2>
            {todayLessons.length > 0 && (
              <span className="text-[10px] font-bold bg-rg-clay/10 text-rg-clay px-2 py-0.5 rounded-full">
                {todayLessons.length}
              </span>
            )}
          </div>

          {todayLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-rg-dark/10 text-center">
              <div className="w-12 h-12 rounded-full bg-rg-dark/5 flex items-center justify-center mb-3">
                <CalendarDays size={20} className="text-rg-dark/30" />
              </div>
              <p className="text-sm font-medium text-rg-dark/40">
                Nessuna lezione programmata per oggi
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {todayLessons.map((lesson) => {
                const lessonStart = new Date(lesson.start_time)
                const lessonEnd = new Date(lesson.end_time)
                const isPast = lessonEnd < now
                const isActive = lessonStart <= now && lessonEnd > now
                const isUpcoming = lessonStart > now

                // Status pill style
                const pillClass = isPast
                  ? 'bg-rg-dark/8 text-rg-dark/40 border border-rg-dark/10'
                  : isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rg-clay/10 text-rg-clay border border-rg-clay/20'

                const pillLabel = isPast ? 'Passata' : isActive ? 'In corso' : 'Prossima'

                return (
                  <div
                    key={lesson.id}
                    className="rounded-2xl border border-rg-dark/10 shadow-sm bg-white px-5 py-4 flex items-center gap-4"
                  >
                    {/* Left: time + court */}
                    <div className="flex flex-col gap-1 min-w-[90px]">
                      <span className="text-sm font-bold text-rg-dark tabular-nums">
                        {fmtTime(lesson.start_time)}–{fmtTime(lesson.end_time)}
                      </span>
                      <span className="text-xs text-rg-dark/40 truncate">
                        {lesson.courts?.name ?? '—'}
                        {lesson.courts?.surface_type
                          ? ` · ${lesson.courts.surface_type}`
                          : ''}
                      </span>
                    </div>

                    {/* Center: student name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-rg-dark truncate">
                        {lesson.student_name ?? <span className="text-rg-dark/30 font-normal italic">Allievo non specificato</span>}
                      </p>
                    </div>

                    {/* Right: status + cancel link */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${pillClass}`}
                      >
                        {isActive && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                        )}
                        {pillLabel}
                      </span>
                      {isUpcoming && (
                        <Link
                          href="/dashboard/my-bookings"
                          className="text-[11px] font-medium text-rg-dark/40 hover:text-rg-clay transition-colors underline underline-offset-2"
                        >
                          Annulla
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── 4. Prossime lezioni (7 giorni) ──────────────────────────── */}
        <section className="mb-10 pb-8 border-b border-rg-dark/10">
          <div className="flex items-center gap-2 mb-5">
            <CalendarDays size={18} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-rg-dark">Prossime lezioni</h2>
            <span className="text-[10px] font-bold text-rg-dark/30 uppercase tracking-wide">
              7 giorni
            </span>
            {upcomingLessons.length > 0 && (
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">
                {upcomingLessons.length}
              </span>
            )}
          </div>

          {upcomingLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-rg-dark/10 text-center">
              <div className="w-12 h-12 rounded-full bg-rg-dark/5 flex items-center justify-center mb-3">
                <BookOpen size={20} className="text-rg-dark/30" />
              </div>
              <p className="text-sm font-medium text-rg-dark/40">
                Nessuna lezione nei prossimi 7 giorni
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {[...upcomingByDate.entries()].map(([dateKey, lessons]) => (
                <div key={dateKey}>
                  {/* Date group header */}
                  <p className="text-[11px] font-bold text-rg-dark/40 uppercase tracking-widest mb-2">
                    {capitalize(fmtDate(dateKey))}
                  </p>
                  <div className="flex flex-col gap-2">
                    {lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 rounded-xl border border-rg-dark/8 bg-white px-4 py-3"
                      >
                        <Clock size={14} className="text-rg-dark/30 flex-shrink-0" />
                        <span className="text-sm font-semibold text-rg-dark tabular-nums">
                          {fmtTime(lesson.start_time)}–{fmtTime(lesson.end_time)}
                        </span>
                        <span className="text-rg-dark/30">·</span>
                        <span className="text-sm text-rg-dark/60 truncate">
                          {lesson.courts?.name ?? '—'}
                        </span>
                        <span className="text-rg-dark/30">·</span>
                        <span className="text-sm font-medium text-rg-dark truncate">
                          {lesson.student_name ?? (
                            <span className="text-rg-dark/30 italic font-normal">N/A</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 5. Questo mese — stats ───────────────────────────────────── */}
        <section className="mb-10 pb-8 border-b border-rg-dark/10">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={18} className="text-amber-500" />
            <h2 className="text-lg font-bold text-rg-dark">Questo mese</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Total lessons */}
            <div className="rounded-2xl border border-rg-dark/10 bg-white px-5 py-4 text-center">
              <p className="text-2xl font-extrabold text-rg-dark">{monthCount}</p>
              <p className="text-xs text-rg-dark/40 mt-0.5">
                {monthCount === 1 ? 'lezione' : 'lezioni totali'}
              </p>
            </div>

            {/* Hours taught */}
            <div className="rounded-2xl border border-rg-dark/10 bg-white px-5 py-4 text-center">
              <p className="text-2xl font-extrabold text-rg-dark">{monthHours}</p>
              <p className="text-xs text-rg-dark/40 mt-0.5">ore insegnate</p>
            </div>

            {/* Unique students */}
            <div className="rounded-2xl border border-rg-dark/10 bg-white px-5 py-4 text-center">
              <p className="text-2xl font-extrabold text-rg-dark">{uniqueStudents.length}</p>
              <p className="text-xs text-rg-dark/40 mt-0.5">
                {uniqueStudents.length === 1 ? 'allievo' : 'allievi diversi'}
              </p>
            </div>
          </div>

          {/* Top student */}
          {topStudent && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <Users size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-rg-dark/40 uppercase tracking-wide font-bold">
                  Allievo più frequente
                </p>
                <p className="text-sm font-bold text-rg-dark">
                  {topStudent[0]}{' '}
                  <span className="font-normal text-rg-dark/50">
                    ({topStudent[1]} {topStudent[1] === 1 ? 'lezione' : 'lezioni'})
                  </span>
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── 6. Accesso rapido ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Zap size={18} className="text-rg-clay" />
            <h2 className="text-lg font-bold text-rg-dark">Accesso rapido</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Book a lesson */}
            <Link
              href="/dashboard"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rg-dark/10 bg-white hover:border-rg-clay/40 hover:shadow-md transition-all px-5 py-4 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rg-clay/10 flex items-center justify-center flex-shrink-0 group-hover:bg-rg-clay/20 transition-colors">
                  <BookOpen size={18} className="text-rg-clay" />
                </div>
                <div>
                  <p className="font-bold text-rg-dark text-sm">Prenota una lezione</p>
                  <p className="text-xs text-rg-dark/40">Scegli campo e orario</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-rg-dark/30 group-hover:text-rg-clay transition-colors" />
            </Link>

            {/* My bookings */}
            <Link
              href="/dashboard/my-bookings"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rg-dark/10 bg-white hover:border-indigo-300 hover:shadow-md transition-all px-5 py-4 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <CalendarDays size={18} className="text-indigo-500" />
                </div>
                <div>
                  <p className="font-bold text-rg-dark text-sm">Le mie prenotazioni</p>
                  <p className="text-xs text-rg-dark/40">Gestisci e annulla slot</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-rg-dark/30 group-hover:text-indigo-400 transition-colors" />
            </Link>
          </div>
        </section>

      </div>
    </main>
  )
}
