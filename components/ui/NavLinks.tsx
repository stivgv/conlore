'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CalendarDays, GraduationCap, ShieldCheck, Settings } from 'lucide-react'

// Mapping href → permission key in role_permissions table
const PERM_KEY: Record<string, string> = {
  '/dashboard':             'page_dashboard',
  '/dashboard/my-bookings': 'page_my_bookings',
  '/dashboard/teacher':     'page_teacher_dashboard',
}

const baseLinks = [
  { href: '/dashboard',             label: 'Campi',        Icon: LayoutGrid    },
  { href: '/dashboard/my-bookings', label: 'Prenotazioni', Icon: CalendarDays  },
  { href: '/dashboard/teacher',     label: 'Maestro',      Icon: GraduationCap },
]

const adminLinks = [
  { href: '/admin',              label: 'Pannello',      Icon: ShieldCheck },
  { href: '/admin/impostazioni', label: 'Impostazioni',  Icon: Settings    },
]

interface NavLinksProps {
  isAdmin?:     boolean
  /** True when admin is currently simulating a non-admin role */
  isSimulating?: boolean
  /** Permission map for the active role — null means full access (admin not simulating) */
  permissions?: Record<string, boolean> | null
}

export default function NavLinks({ isAdmin, isSimulating, permissions }: NavLinksProps) {
  const pathname = usePathname()

  // Filter base links by role_permissions (null = no filter, all visible)
  const visibleBase = baseLinks.filter(link => {
    if (!permissions) return true
    const key = PERM_KEY[link.href]
    return key ? (permissions[key] !== false) : true
  })

  // Admin-specific links only when actually admin and NOT simulating another role
  const links = (isAdmin && !isSimulating)
    ? [...visibleBase, ...adminLinks]
    : visibleBase

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label, Icon }) => {
        const isActive = href === '/'
          ? pathname === href
          : pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-rg-clay/10 text-rg-clay font-semibold'
                : 'text-rg-dark/50 hover:text-rg-dark hover:bg-rg-dark/5'
            }`}
          >
            <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
