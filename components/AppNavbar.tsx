import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/dashboard/actions'
import NavLinks from '@/components/ui/NavLinks'
import { LogOut } from 'lucide-react'

export default async function AppNavbar() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role, email, name')
    .eq('id', authUser.id)
    .single<{ role: string; email: string; name: string }>()

  const isAdmin      = profile?.role === 'admin'
  const email        = profile?.email ?? authUser.email ?? ''
  const displayName  = profile?.name || email
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-rg-dark/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Brand + nav */}
        <div className="flex items-center gap-6 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-rg-dark flex items-center justify-center shadow-sm group-hover:bg-rg-clay transition-colors">
              <span className="text-white text-sm select-none">🎾</span>
            </div>
            <span className="font-bold text-rg-dark text-sm tracking-tight hidden sm:block">
              Tennis Club
            </span>
          </Link>
          <NavLinks />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              ⚙ Admin
            </Link>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rg-clay/15 border border-rg-clay/30 flex items-center justify-center flex-shrink-0">
              <span className="text-rg-dark text-xs font-bold">{avatarLetter}</span>
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-xs font-medium text-rg-dark truncate max-w-[140px]">{displayName}</span>
              <span className="text-[11px] text-rg-dark/45 capitalize">{profile?.role ?? 'member'}</span>
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
