'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CalendarDays, Calendar } from 'lucide-react'

const links = [
  { href: '/dashboard',             label: 'Campi',        Icon: LayoutGrid   },
  { href: '/dashboard/my-bookings', label: 'Prenotazioni', Icon: CalendarDays },
  { href: '/schedule',              label: 'Orario',       Icon: Calendar     },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label, Icon }) => {
        // Per href '/' usa match esatto per evitare che matchi tutto
        // Per gli altri href: attivo se siamo esattamente su quella pagina o in una sua sotto-pagina
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
