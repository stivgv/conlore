import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/dashboard/actions'
import NavLinks from '@/components/ui/NavLinks'
import ProfileSimulator from '@/components/ui/ProfileSimulator'
import { getSimulatedRole } from '@/lib/simulate'
import { LogOut } from 'lucide-react'

export default async function AppNavbar() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role, email, name, color_code')
    .eq('id', authUser.id)
    .single<{ role: string; email: string; name: string; color_code: string | null }>()

  const isAdmin   = profile?.role === 'admin'
  const isTeacher = profile?.role === 'teacher'

  // If admin is simulating a role, read the cookie
  const simulatingRole = isAdmin ? await getSimulatedRole() : null
  const activeRole     = simulatingRole ?? (profile?.role as 'admin' | 'member' | 'teacher' ?? 'member')

  const email        = profile?.email ?? authUser.email ?? ''
  const displayName  = profile?.name || email
  const avatarLetter = displayName.charAt(0).toUpperCase()

  const roleDisplay =
    activeRole === 'teacher' ? 'Maestro' :
    activeRole === 'admin'   ? 'Admin'   : 'Socio'

  // Teacher avatar color (only when actually a teacher, not simulating one)
  const teacherColor = isTeacher ? (profile?.color_code ?? '#6366f1') : null

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-rg-dark/10">

      {/* Simulation banner */}
      {simulatingRole && (
        <div className="bg-violet-600 text-white text-xs font-medium text-center py-1 px-4">
          👁 Modalità simulazione — vista{' '}
          <span className="font-bold">{simulatingRole === 'teacher' ? 'Maestro' : 'Socio'}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">

        {/* Brand + nav */}
        <div className="flex items-center gap-1.5 sm:gap-5 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-rg-dark flex items-center justify-center shadow-sm group-hover:bg-rg-clay transition-colors">
              <span className="text-white text-sm select-none">🎾</span>
            </div>
            <span className="font-bold text-rg-dark text-sm tracking-tight hidden sm:block">
              Tennis Club
            </span>
          </Link>
          <NavLinks isAdmin={isAdmin} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">

          {/* Teacher badge (non-admin teachers only) */}
          {isTeacher && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              🎾 Maestro
            </span>
          )}

          {/* Profile simulator (admin only) */}
          {isAdmin && <ProfileSimulator simulatingRole={simulatingRole} />}

          {/* Profile display */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={teacherColor
                ? { backgroundColor: `${teacherColor}22`, border: `1px solid ${teacherColor}60` }
                : { backgroundColor: 'rgb(213 69 39 / 0.15)', border: '1px solid rgb(213 69 39 / 0.30)' }
              }
            >
              <span
                className="text-xs font-bold"
                style={teacherColor ? { color: teacherColor } : { color: '#311815' }}
              >
                {avatarLetter}
              </span>
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-xs font-medium text-rg-dark truncate max-w-[140px]">{displayName}</span>
              <span className="text-[11px] text-rg-dark/45">{roleDisplay}</span>
            </div>
          </div>

          <form>
            <button
              formAction={signOut}
              className="flex items-center gap-1.5 text-sm text-rg-dark/30 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
              title="Esci"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>

      </div>
    </header>
  )
}
