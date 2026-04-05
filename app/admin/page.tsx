import { createClient } from '@/lib/supabase/server'
import { ShieldCheck, Layers, CalendarDays, Users, Euro, Clock, AlertTriangle } from 'lucide-react'
import AdminToggleButton from '@/components/ui/AdminToggleButton'
import AdminCancelButton from '@/components/ui/AdminCancelButton'
import AdminPaymentButton from '@/components/ui/AdminPaymentButton'
import AnalogReminderBanner from '@/components/ui/AnalogReminderBanner'

type CourtRow = {
  id: string
  name: string
  surface_type: string
  is_active: boolean
}

type UserRow = {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

type BookingRow = {
  id: string
  start_time: string
  end_time: string
  status: string
  total_price: number | null
  payment_status: string | null
  booking_type: 'member' | 'teacher' | null
  student_name: string | null
  courts: { name: string } | null
  users:  { email: string; name: string } | null
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

function formatTime(start: string, end: string) {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s))
  return `${fmt(start)} – ${fmt(end)}`
}

const bookingStatusConfig: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending:   'bg-yellow-50  text-yellow-700  border border-yellow-200',
  cancelled: 'bg-gray-100   text-gray-500    border border-gray-200',
}

const bookingStatusLabel: Record<string, string> = {
  confirmed: 'Confermata',
  pending:   'In attesa',
  cancelled: 'Annullata',
}

export default async function AdminPage() {
  // Auth + role check is already handled by AdminLayout — no need to repeat it here.
  const supabase = await createClient()

  const [courtsResult, bookingsResult, usersResult] = await Promise.all([
    supabase
      .from('courts')
      .select('id, name, surface_type, is_active')
      .order('name')
      .returns<CourtRow[]>(),
    supabase
      .from('bookings')
      .select('id, start_time, end_time, status, total_price, payment_status, booking_type, student_name, courts(name), users(email, name)')
      .order('start_time', { ascending: false })
      .returns<BookingRow[]>(),
    supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false })
      .returns<UserRow[]>(),
  ])

  const courts   = courtsResult.data  ?? []
  const bookings = bookingsResult.data ?? []
  const users    = usersResult.data    ?? []

  // KPI calculations
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed')
  const paidBookings      = bookings.filter(b => b.payment_status === 'paid')
  const noShowBookings    = bookings.filter(b => b.payment_status === 'no_show')
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled')

  const incassoStimato = confirmedBookings.reduce((sum, b) => sum + (b.total_price ?? 0), 0)

  const oreVendute = confirmedBookings.reduce((sum, b) => {
    const start = new Date(b.start_time).getTime()
    const end   = new Date(b.end_time).getTime()
    return sum + (end - start) / 3_600_000
  }, 0)

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 space-y-10">

      {/* Banner promemoria analogico — mostrato in cima alla dashboard admin */}
      <AnalogReminderBanner />

      {/* Page header */}
      <div className="pb-8 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} className="text-amber-600" />
          <span className="text-sm font-medium text-amber-600">Amministratore</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Centro di Controllo</h1>
        <p className="text-gray-500 mt-2">Gestisci campi, prenotazioni e soci del club.</p>
      </div>

      {/* ── KPI Cards ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Riepilogo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Euro size={15} className="text-emerald-700" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incasso Stimato</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">€{incassoStimato.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-1">{confirmedBookings.length} prenotazioni confermate</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock size={15} className="text-blue-700" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ore Vendute</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{oreVendute.toFixed(1)}h</p>
            <p className="text-xs text-gray-400 mt-1">su {courts.length} campi disponibili</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Euro size={15} className="text-emerald-700" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incassato</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{paidBookings.length}</p>
            <p className="text-xs text-gray-400 mt-1">pagamenti confermati</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle size={15} className="text-red-600" />
              </div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">No-Show / Annullati</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{noShowBookings.length + cancelledBookings.length}</p>
            <p className="text-xs text-gray-400 mt-1">{noShowBookings.length} no-show · {cancelledBookings.length} annullati</p>
          </div>

        </div>
      </section>

      {/* ── Secretary Master Table ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <CalendarDays size={15} className="text-blue-700" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Tutte le Prenotazioni</h2>
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{bookings.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Utente', 'Campo', 'Data & Ora', 'Totale', 'Prenotazione', 'Pagamento', 'Azioni'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">Nessuna prenotazione trovata.</td>
                  </tr>
                ) : (
                  bookings.map((booking, i) => (
                    <tr key={booking.id} className={`border-b border-gray-100 last:border-b-0 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>

                      {/* Utente */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-rg-clay/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-rg-clay text-[10px] font-bold">
                              {(booking.users?.name || booking.users?.email || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {booking.users?.name && (
                                <p className="text-xs font-semibold text-gray-800 truncate">{booking.users.name}</p>
                              )}
                              {/* Pillola "Lezione" per prenotazioni teacher */}
                              {booking.booking_type === 'teacher' && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                  Lezione
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">{booking.users?.email ?? '—'}</p>
                            {/* Nome studente per prenotazioni teacher */}
                            {booking.booking_type === 'teacher' && booking.student_name && (
                              <p className="text-[11px] text-indigo-500 truncate">👤 {booking.student_name}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Campo */}
                      <td className="px-4 py-3.5 font-medium text-gray-800 whitespace-nowrap">
                        {booking.courts?.name ?? '—'}
                      </td>

                      {/* Data & Ora */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-xs text-gray-700">{formatDate(booking.start_time)}</p>
                        <p className="text-[11px] font-mono text-gray-400 mt-0.5">{formatTime(booking.start_time, booking.end_time)}</p>
                      </td>

                      {/* Totale */}
                      <td className="px-4 py-3.5 text-gray-800 font-semibold whitespace-nowrap">
                        {booking.total_price != null && booking.total_price > 0
                          ? `€${booking.total_price.toFixed(2)}`
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Stato Prenotazione */}
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${bookingStatusConfig[booking.status] ?? bookingStatusConfig['cancelled']}`}>
                          {bookingStatusLabel[booking.status] ?? booking.status}
                        </span>
                      </td>

                      {/* Stato Pagamento */}
                      <td className="px-4 py-3.5">
                        {booking.status === 'confirmed' || booking.payment_status != null
                          ? <AdminPaymentButton bookingId={booking.id} paymentStatus={booking.payment_status} />
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>

                      {/* Azioni */}
                      <td className="px-4 py-3.5">
                        {booking.status === 'confirmed' && (
                          <AdminCancelButton bookingId={booking.id} />
                        )}
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Courts ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Layers size={15} className="text-emerald-700" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Campi</h2>
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{courts.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Nome Campo', 'Superficie', 'Stato', 'Azione'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courts.map((court, i) => (
                <tr key={court.id} className={`border-b border-gray-100 last:border-b-0 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{court.name}</td>
                  <td className="px-5 py-3.5 text-gray-500 capitalize">{court.surface_type}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      court.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}>
                      {court.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <AdminToggleButton courtId={court.id} isActive={court.is_active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Members ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Users size={15} className="text-purple-700" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Soci</h2>
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{users.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Email', 'Nome', 'Ruolo', 'Iscritto il'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const initial = (user.name || user.email || '?').charAt(0).toUpperCase()
                return (
                  <tr key={user.id} className={`border-b border-gray-100 last:border-b-0 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-700 text-xs font-bold">{initial}</span>
                        </div>
                        <span className="text-gray-700 text-xs">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{user.name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        user.role === 'admin'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Socio'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(user.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

    </main>
  )
}
