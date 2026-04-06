'use client'

/**
 * AdminDayGrid — Griglia giornaliera potenziata per l'admin.
 *
 * Colori:
 *   🟩 Verde (emerald)  → Socio o Esterno
 *   🟪 Viola (violet)   → Lezione Maestro
 *
 * Click su slot VUOTO  → popup "Aggiungi" (Socio / Esterno / Lezione)
 * Click su slot OCCUPATO → popup "Gestione" (Cancella + Chiama)
 */

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays, X, Phone, Trash2,
  UserRound, GraduationCap, Users, Mail, MessageCircle, ChevronLeft,
} from 'lucide-react'
import { type ScheduleCourt } from '@/components/GlobalScheduleGrid'
import {
  adminCancelBooking,
  adminBookForMember,
  adminBookExternal,
  adminBookLesson,
} from '@/app/admin/actions'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AdminGridBooking {
  id:             string
  court_id:       string
  user_id:        string
  start_time:     string
  end_time:       string
  booking_type:   'member' | 'teacher'
  student_name:   string | null
  status:         string
  payment_status: string | null
  user_name:      string
  user_email:     string
  user_color:     string | null
}

export interface MemberOption  { id: string; name: string; email: string }
export interface TeacherOption { id: string; name: string; color_code: string | null }

interface AdminDayGridProps {
  courts:   ScheduleCourt[]
  bookings: AdminGridBooking[]
  date:     string
  today:    string
  members:  MemberOption[]
  teachers: TeacherOption[]
}

type PopupState =
  | null
  | { kind: 'add';    courtId: string; courtName: string; slot: string }
  | { kind: 'manage'; booking: AdminGridBooking; courtName: string }

// ─── Constants ──────────────────────────────────────────────────────────────

const HOUR_SLOTS = Array.from({ length: 15 }, (_, i) =>
  `${String(8 + i).padStart(2, '0')}:00`
)

const DURATION_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 2, label: '2h' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function offsetDate(d: string, days: number): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day + days).toLocaleDateString('en-CA')
}

function isApplicable(court: ScheduleCourt, slot: string): boolean {
  const [sh, sm] = slot.split(':').map(Number)
  const [oh, om] = court.open_time.split(':').map(Number)
  const [ch, cm] = court.close_time.split(':').map(Number)
  return (sh * 60 + sm) >= (oh * 60 + om) && (sh * 60 + sm) < (ch * 60 + cm)
}

function getBooking(bookings: AdminGridBooking[], courtId: string, date: string, slot: string): AdminGridBooking | null {
  const start = new Date(`${date}T${slot}:00Z`)
  const end   = new Date(start.getTime() + 3_600_000)
  return bookings.find(b =>
    b.court_id === courtId &&
    new Date(b.start_time) < end &&
    new Date(b.end_time)   > start
  ) ?? null
}

function isPast(date: string, slot: string): boolean {
  return new Date(`${date}T${slot}:00Z`).getTime() + 3_600_000 <= Date.now()
}

function fmtHM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Distingue il tipo di prenotazione per il display */
function bookingKind(b: AdminGridBooking): 'teacher' | 'external' | 'member' {
  if (b.booking_type === 'teacher') return 'teacher'
  if (b.student_name)               return 'external'
  return 'member'
}

/** Nome da mostrare nello slot */
function displayName(b: AdminGridBooking): string {
  if (b.booking_type === 'teacher') return b.user_name
  if (b.student_name)               return b.student_name.split('|')[0]
  return b.user_name
}

/** Telefono estratto dal campo student_name (formato "Nome|telefono") */
function extractPhone(b: AdminGridBooking): string | null {
  if (b.student_name?.includes('|')) return b.student_name.split('|')[1] || null
  return null
}

/** Scorciatoie giornaliere */
function getShortcutDays(today: string) {
  const labels: Record<number, string> = { 0: 'Oggi', 1: 'Domani', 2: 'Dopo' }
  return Array.from({ length: 7 }, (_, i) => {
    const d  = offsetDate(today, i)
    const dt = new Date(`${d}T12:00:00`)
    const wd = dt.toLocaleDateString('it-IT', { weekday: 'short' })
    return {
      date:     d,
      label:    labels[i] ?? (wd.charAt(0).toUpperCase() + wd.slice(1)),
      sublabel: `${dt.getDate()}/${dt.getMonth() + 1}`,
    }
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminDayGrid({
  courts, bookings, date, today, members, teachers,
}: AdminDayGridProps) {
  const router       = useRouter()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [popup, setPopup]     = useState<PopupState>(null)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add-form state
  const [tab,         setTab]         = useState<'socio' | 'esterno' | 'lezione'>('socio')
  const [userId,      setUserId]      = useState('')
  const [extName,     setExtName]     = useState('')
  const [extPhone,    setExtPhone]    = useState('')
  const [teacherId,   setTeacherId]   = useState('')
  const [studentName, setStudentName] = useState('')
  const [duration,      setDuration]      = useState(1)
  const [customDuration, setCustomDuration] = useState('')  // ore libere (stringa)
  // Manage-form state
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Contact panel state
  const [contactPanel, setContactPanel] = useState(false)
  const [emailBody,    setEmailBody]    = useState('')

  const shortcuts    = getShortcutDays(today)
  const prevDay      = offsetDate(date, -1)
  const nextDay      = offsetDate(date, +1)
  const gridDateLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00`))

  const tableMinWidth = `${52 + courts.length * 150}px`

  // ── Popup helpers ──────────────────────────────────────────────────────────

  function openAdd(courtId: string, courtName: string, slot: string) {
    setTab('socio'); setUserId(''); setExtName(''); setExtPhone('')
    setTeacherId(''); setStudentName(''); setDuration(1); setCustomDuration('')
    setError(null); setSuccess(null); setConfirmCancel(false)
    setPopup({ kind: 'add', courtId, courtName, slot })
  }

  function openManage(booking: AdminGridBooking, courtName: string) {
    setConfirmCancel(false); setContactPanel(false); setEmailBody('')
    setError(null); setSuccess(null)
    setPopup({ kind: 'manage', booking, courtName })
  }

  function closePopup() {
    setPopup(null); setError(null); setSuccess(null)
    setContactPanel(false); setEmailBody('')
  }

  // ── Submit add booking ─────────────────────────────────────────────────────

  function handleAdd() {
    if (popup?.kind !== 'add') return
    const { courtId, slot } = popup

    // Resolve effective duration: custom input overrides preset buttons
    const effectiveDuration = customDuration
      ? Math.max(1, Math.round(parseFloat(customDuration)))
      : duration

    startTransition(async () => {
      setError(null)
      let result

      if (tab === 'socio') {
        if (!userId) { setError('Seleziona un socio.'); return }
        result = await adminBookForMember(courtId, date, slot, effectiveDuration, userId)
      } else if (tab === 'esterno') {
        if (!extName.trim()) { setError('Inserisci il nome.'); return }
        result = await adminBookExternal(courtId, date, slot, effectiveDuration, extName, extPhone)
      } else {
        if (!teacherId) { setError('Seleziona un maestro.'); return }
        result = await adminBookLesson(courtId, date, slot, effectiveDuration, teacherId, studentName)
      }

      if (result.status === 'error') { setError(result.message) }
      else { setSuccess(result.message); setTimeout(closePopup, 1200) }
    })
  }

  // ── Cancel booking ─────────────────────────────────────────────────────────

  function handleCancel() {
    if (popup?.kind !== 'manage') return
    startTransition(async () => {
      const result = await adminCancelBooking(popup.booking.id)
      if (result.status === 'error') { setError(result.message) }
      else { closePopup() }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* ── Titolo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2 text-xs font-medium">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Socio / Esterno
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            <span className="w-2 h-2 rounded-full bg-violet-500" /> Lezione
          </span>
        </div>
      </div>

      {/* ── Navigazione ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin?date=${prevDay}`}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 text-gray-400 font-bold hover:border-rg-clay hover:text-rg-clay transition-all flex-shrink-0"
        >←</Link>

        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker()}
          className="flex-1 flex items-center justify-center gap-2 font-bold text-gray-800 text-base capitalize hover:text-rg-clay transition-colors group"
        >
          <span>{gridDateLabel}</span>
          <CalendarDays size={15} className="text-gray-300 group-hover:text-rg-clay transition-colors" />
        </button>
        <input
          ref={dateInputRef} type="date" value={date}
          onChange={(e) => { if (e.target.value) router.push(`/admin?date=${e.target.value}`) }}
          className="sr-only" aria-hidden="true"
        />

        <Link
          href={`/admin?date=${nextDay}`}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 text-gray-400 font-bold hover:border-rg-clay hover:text-rg-clay transition-all flex-shrink-0"
        >→</Link>

        {date !== today && (
          <Link href="/admin" className="px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 bg-rg-clay text-white hover:bg-rg-dark transition-colors">
            Oggi
          </Link>
        )}
      </div>

      {/* ── Scorciatoie ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {shortcuts.map(({ date: d, label, sublabel }) => {
          const isActive = d === date
          return (
            <Link
              key={d}
              href={`/admin?date=${d}`}
              className={[
                'flex flex-col items-center px-3 py-2 rounded-xl text-center flex-shrink-0 transition-all min-w-[52px]',
                isActive ? 'bg-rg-clay text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              ].join(' ')}
            >
              <span className="text-[11px] font-bold leading-none">{label}</span>
              <span className={`text-[10px] mt-0.5 leading-none ${isActive ? 'text-white/75' : 'text-gray-400'}`}>{sublabel}</span>
            </Link>
          )
        })}
      </div>

      {/* ── Griglia ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm w-full overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: tableMinWidth }}>
          <thead>
            <tr style={{ background: '#311815' }}>
              <th className="w-[52px] px-3 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest border-r border-white/8">ORA</th>
              {courts.map(court => (
                <th key={court.id} className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/8 last:border-r-0">
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOUR_SLOTS.map((slot, rowIdx) => (
              <tr key={slot} className={`border-t border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="px-3 py-1.5 w-[52px] border-r border-gray-100 align-top">
                  <span className="text-xs font-bold text-gray-400">{slot}</span>
                </td>

                {courts.map(court => {
                  const applicable = isApplicable(court, slot)
                  const past       = isPast(date, slot)
                  const booking    = getBooking(bookings, court.id, date, slot)

                  // Fuori orario
                  if (!applicable) {
                    return (
                      <td key={court.id} className="px-1.5 py-1.5 border-r border-gray-100 last:border-r-0 bg-gray-100/40">
                        <div className="h-[48px] rounded-xl flex items-center justify-center">
                          <span className="text-xs text-gray-300 select-none">—</span>
                        </div>
                      </td>
                    )
                  }

                  // Slot occupato
                  if (booking) {
                    const kind  = bookingKind(booking)
                    const name  = displayName(booking)
                    const isStart = new Date(booking.start_time).getUTCHours() === parseInt(slot)
                    const isTeacher = kind === 'teacher'

                    const cellStyle = isTeacher
                      ? 'bg-violet-50 border border-violet-200 border-l-[3px] border-l-violet-500'
                      : 'bg-emerald-50 border border-emerald-200 border-l-[3px] border-l-emerald-500'
                    const nameStyle = isTeacher ? 'text-violet-800' : 'text-emerald-800'
                    const subStyle  = isTeacher ? 'text-violet-500' : 'text-emerald-500'

                    return (
                      <td key={court.id} className="px-1.5 py-1.5 border-r border-gray-100 last:border-r-0">
                        <button
                          type="button"
                          onClick={() => openManage(booking, court.name)}
                          className={`w-full h-[48px] rounded-xl ${cellStyle} flex flex-col justify-center px-2.5 gap-0.5 text-left hover:brightness-95 transition-all`}
                        >
                          {isStart ? (
                            <>
                              <span className={`text-[11px] font-bold leading-none truncate ${nameStyle}`}>
                                {isTeacher ? '🎾' : '👤'} {name}
                              </span>
                              {isTeacher && booking.student_name && (
                                <span className={`text-[10px] leading-none truncate ${subStyle} pl-4`}>
                                  → {booking.student_name}
                                </span>
                              )}
                              {!isTeacher && (
                                <span className={`text-[10px] leading-none ${subStyle} pl-4`}>
                                  {fmtHM(booking.start_time)}–{fmtHM(booking.end_time)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className={`text-[10px] font-semibold ${subStyle}`}>↑</span>
                          )}
                        </button>
                      </td>
                    )
                  }

                  // Slot passato + libero
                  if (past) {
                    return (
                      <td key={court.id} className="px-1.5 py-1.5 border-r border-gray-100 last:border-r-0">
                        <div className="h-[48px] rounded-xl bg-gray-50 flex items-center justify-center">
                          <span className="text-xs text-gray-300 select-none">—</span>
                        </div>
                      </td>
                    )
                  }

                  // Slot libero
                  return (
                    <td key={court.id} className="px-1.5 py-1.5 border-r border-gray-100 last:border-r-0">
                      <button
                        type="button"
                        onClick={() => openAdd(court.id, court.name, slot)}
                        className="w-full h-[48px] rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-rg-clay hover:bg-rg-clay/5 transition-all group flex flex-col items-center justify-center gap-0.5"
                      >
                        <span className="text-xl font-light text-gray-200 group-hover:text-rg-clay transition-colors">+</span>
                        <span className="text-[10px] text-gray-200 group-hover:text-rg-clay/70 transition-colors font-medium">Aggiungi</span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          POPUP AGGIUNGI
      ══════════════════════════════════════════════════════════════════════ */}
      {popup?.kind === 'add' && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={closePopup}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 font-medium">{popup.courtName} · {popup.slot}</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">Aggiungi prenotazione</p>
              </div>
              <button type="button" onClick={closePopup} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <X size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {([
                { key: 'socio',   icon: <UserRound size={13} />,     label: 'Socio'   },
                { key: 'esterno', icon: <Users size={13} />,          label: 'Esterno' },
                { key: 'lezione', icon: <GraduationCap size={13} />,  label: 'Lezione' },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTab(key); setError(null) }}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2',
                    tab === key
                      ? 'border-rg-clay text-rg-clay'
                      : 'border-transparent text-gray-400 hover:text-gray-700',
                  ].join(' ')}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="px-5 py-4 space-y-3">

              {/* Socio tab */}
              {tab === 'socio' && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 mb-1 block">Socio</span>
                    <select
                      value={userId}
                      onChange={e => setUserId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-rg-clay bg-white"
                    >
                      <option value="">Seleziona socio…</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name || m.email}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {/* Esterno tab */}
              {tab === 'esterno' && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 mb-1 block">Nome *</span>
                    <input
                      type="text"
                      value={extName}
                      onChange={e => setExtName(e.target.value)}
                      placeholder="es. Giovanni Rossi"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-rg-clay"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 mb-1 block">Telefono (opzionale)</span>
                    <input
                      type="tel"
                      value={extPhone}
                      onChange={e => setExtPhone(e.target.value)}
                      placeholder="es. 333 1234567"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-rg-clay"
                    />
                  </label>
                </div>
              )}

              {/* Lezione tab */}
              {tab === 'lezione' && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 mb-1 block">Maestro *</span>
                    <select
                      value={teacherId}
                      onChange={e => setTeacherId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-rg-clay bg-white"
                    >
                      <option value="">Seleziona maestro…</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-500 mb-1 block">Nome allievo</span>
                    <input
                      type="text"
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      placeholder="es. Marco Bianchi"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-rg-clay"
                    />
                  </label>
                </div>
              )}

              {/* Durata */}
              <div>
                <span className="text-xs font-semibold text-gray-500 mb-1 block">Durata</span>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setDuration(opt.value); setCustomDuration('') }}
                      className={[
                        'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                        !customDuration && duration === opt.value
                          ? 'bg-rg-clay text-white border-rg-clay'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-rg-clay hover:text-rg-clay',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {/* Campo ore libere */}
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      step="1"
                      placeholder="Altro"
                      value={customDuration}
                      onChange={e => setCustomDuration(e.target.value)}
                      className={[
                        'w-full py-1.5 px-2 rounded-lg text-xs font-semibold border text-center transition-colors focus:outline-none',
                        customDuration
                          ? 'bg-rg-clay text-white border-rg-clay placeholder-white/70'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-rg-clay focus:border-rg-clay',
                      ].join(' ')}
                    />
                    {customDuration && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/80 pointer-events-none">h</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback */}
              {error   && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              {success && <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">{success}</p>}

              {/* Submit */}
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-rg-dark text-white text-sm font-semibold hover:bg-rg-clay transition-colors disabled:opacity-50"
              >
                {isPending ? 'Salvataggio…' : 'Conferma prenotazione'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          POPUP GESTIONE
      ══════════════════════════════════════════════════════════════════════ */}
      {popup?.kind === 'manage' && (() => {
        const { booking, courtName } = popup
        const kind   = bookingKind(booking)
        const name   = displayName(booking)
        const phone  = extractPhone(booking)
        const isTeacher = kind === 'teacher'

        return (
          <div
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
            onClick={closePopup}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">{courtName} · {fmtHM(booking.start_time)}–{fmtHM(booking.end_time)}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5 flex items-center gap-2">
                    {isTeacher ? '🎾' : '👤'} {name}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isTeacher ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isTeacher ? 'Lezione' : kind === 'external' ? 'Esterno' : 'Socio'}
                    </span>
                  </p>
                  {isTeacher && booking.student_name && (
                    <p className="text-xs text-gray-400 mt-0.5">Allievo: {booking.student_name}</p>
                  )}
                </div>
                <button type="button" onClick={closePopup} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  <X size={14} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-2.5">

                {/* ── Pannello contatto ────────────────────────────────── */}
                {contactPanel ? (
                  <div className="space-y-2.5">

                    {/* Back */}
                    <button
                      type="button"
                      onClick={() => { setContactPanel(false); setEmailBody('') }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <ChevronLeft size={13} /> Indietro
                    </button>

                    {/* Chiama */}
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/\s+/g, '')}`}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-sm font-semibold hover:bg-blue-100 transition-colors"
                      >
                        <Phone size={14} /> Chiama {phone}
                      </a>
                    )}

                    {/* Invia email */}
                    {(booking.user_email || phone) && (
                      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Mail size={12} className="text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500">
                            Scrivi email a {booking.user_email || name}
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          placeholder={`Gentile ${name.split(' ')[0]},\n\n`}
                          value={emailBody}
                          onChange={e => setEmailBody(e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-rg-clay resize-none bg-white"
                        />
                        <a
                          href={`mailto:${booking.user_email}?subject=${encodeURIComponent('Tennis Club — Info prenotazione')}&body=${encodeURIComponent(emailBody)}`}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rg-dark text-white text-xs font-semibold hover:bg-rg-clay transition-colors"
                        >
                          <Mail size={12} /> Apri client email
                        </a>
                      </div>
                    )}

                    {!phone && !booking.user_email && (
                      <p className="text-xs text-center text-gray-400 py-2">Nessun contatto disponibile.</p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* ── Vista principale ─────────────────────────────── */}

                    {/* Info contatto */}
                    {(phone || booking.user_email) && (
                      <p className="text-xs text-center text-gray-400">
                        {phone ?? booking.user_email}
                      </p>
                    )}

                    {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

                    {/* Riga azioni principali */}
                    <div className="flex gap-2">

                      {/* Chiama / Messaggio */}
                      <button
                        type="button"
                        onClick={() => { setContactPanel(true); setEmailBody('') }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors"
                      >
                        <MessageCircle size={13} /> Contatta
                      </button>

                      {/* Cancella */}
                      {!confirmCancel ? (
                        <button
                          type="button"
                          onClick={() => setConfirmCancel(true)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={13} /> Cancella
                        </button>
                      ) : (
                        <div className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 space-y-2">
                          <p className="text-[10px] text-red-700 font-semibold text-center">Sei sicuro?</p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancel}
                              disabled={isPending}
                              className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 disabled:opacity-50"
                            >
                              {isPending ? '…' : 'Sì'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancel(false)}
                              className="flex-1 py-1.5 rounded-lg bg-white text-gray-600 border border-gray-200 text-[11px] font-semibold"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
