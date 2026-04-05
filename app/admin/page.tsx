import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShieldCheck, Layers, CalendarDays, Users } from 'lucide-react'
import AdminToggleButton from '@/components/ui/AdminToggleButton'
import AdminCancelButton from '@/components/ui/AdminCancelButton'

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
  courts: { name: string } | null
  users:  { email: string; name: string } | null
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

function formatTime(start: string, end: string) {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s))
  return `${fmt(start)} – ${fmt(end)}`
}

const bookingStatusConfig: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending:   'bg-yellow-50  text-yellow-700  border border-yellow-200',
  cancelled: 'bg-gray-100   text-gray-500    border border-gray-200',
}

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Parallel data fetch — untouched
  const [courtsResult, bookingsResult, usersResult] = await Promise.all([
    supabase
      .from('courts')
      .select('id, name, surface_type, is_active')
      .order('name')
      .returns<CourtRow[]>(),
    supabase
      .from('bookings')
      .select('id, start_time, end_time, status, courts(name), users(email, name)')
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

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">

      {/* Page header */}
      <div className="pb-8 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} className="text-amber-600" />
          <span className="text-sm font-medium text-amber-600">Administrator</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Control Center</h1>
        <p className="text-gray-500 mt-2">Manage courts, bookings, and club members.</p>
      </div>

      {/* ── Courts ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Layers size={15} className="text-emerald-700" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Courts</h2>
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{courts.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Court Name', 'Surface', 'Status', 'Toggle'].map(h => (
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
                      {court.is_active ? 'Active' : 'Inactive'}
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

      {/* ── All Bookings ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <CalendarDays size={15} className="text-blue-700" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">All Bookings</h2>
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{bookings.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Date', 'Time', 'Court', 'Member', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">No bookings found.</td>
                </tr>
              ) : (
                bookings.map((booking, i) => (
                  <tr key={booking.id} className={`border-b border-gray-100 last:border-b-0 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">{formatDate(booking.start_time)}</td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap font-mono text-xs">{formatTime(booking.start_time, booking.end_time)}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{booking.courts?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs truncate max-w-[160px]">{booking.users?.email ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${bookingStatusConfig[booking.status] ?? bookingStatusConfig['cancelled']}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
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
      </section>

      {/* ── Users ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Users size={15} className="text-purple-700" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">All Members</h2>
          <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{users.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Email', 'Name', 'Role', 'Joined'].map(h => (
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
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
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
