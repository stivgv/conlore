import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'
import { signOut } from '@/app/dashboard/actions'
import NavLinks from '@/components/ui/NavLinks'
import { LogOut, ShieldCheck, Settings } from 'lucide-react'

// Server-safe nav link — no hooks, just renders
function AdminNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
    >
      {label}
    </Link>
  )
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, email, name')
    .eq('id', authUser.id)
    .single<Pick<User, 'role' | 'email' | 'name'>>()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const email        = profile?.email ?? authUser.email ?? ''
  const displayName  = profile?.name || email
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Brand + nav */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm group-hover:bg-emerald-700 transition-colors">
                <span className="text-white text-sm select-none">🎾</span>
              </div>
              <span className="font-bold text-gray-900 text-sm tracking-tight hidden sm:block">
                Tennis Club
              </span>
            </Link>
            <NavLinks />
            <div className="hidden sm:flex items-center gap-1">
              <AdminNavLink href="/admin" label="Pannello" />
              <AdminNavLink href="/admin/impostazioni" label="Impostazioni" />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldCheck size={12} />
              Admin
            </span>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 text-xs font-bold">{avatarLetter}</span>
              </div>
              <div className="hidden md:flex flex-col leading-tight">
                <span className="text-xs font-medium text-gray-800 truncate max-w-[140px]">{displayName}</span>
                <span className="text-[11px] text-gray-400">Admin</span>
              </div>
            </div>

            <form>
              <button
                formAction={signOut}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>

        </div>
      </header>

      {children}
    </div>
  )
}
