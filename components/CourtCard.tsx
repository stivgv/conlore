import Link from 'next/link'
import type { Court } from '@/types/database'

// Map each court to its photo URL based on surface + name
function courtImageUrl(court: Court): string {
  const name = court.name.toLowerCase()
  const surf = court.surface_type.toLowerCase()

  // Clay courts
  if (surf.includes('clay') || surf.includes('terra') || surf.includes('rossa') || surf.includes('argilla')) {
    // Campo B gets a different clay photo
    if (name.includes('b')) {
      return 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=800&auto=format&fit=crop'
    }
    // Campo A (and any other clay)
    return 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop'
  }

  // Hard court (Campo C)
  if (surf.includes('hard') || surf.includes('cemento') || surf.includes('resina') || surf.includes('concr')) {
    return 'https://images.unsplash.com/photo-1530915365347-e35b749a0381?q=80&w=800&auto=format&fit=crop'
  }

  // Grass
  if (surf.includes('grass') || surf.includes('erba')) {
    return 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=800&auto=format&fit=crop'
  }

  // Indoor fallback
  return 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=800&auto=format&fit=crop'
}

// Badge colour per surface
function badgeColor(surf: string): string {
  const s = surf.toLowerCase()
  if (s.includes('clay') || s.includes('terra') || s.includes('rossa')) return '#d54527cc'
  if (s.includes('hard') || s.includes('cemento') || s.includes('resina')) return '#2e5ca8cc'
  if (s.includes('grass') || s.includes('erba')) return '#2e7a28cc'
  return '#9a8730cc'
}

export default function CourtCard({ court }: { court: Court }) {
  const openTime  = court.open_time?.slice(0, 5)  ?? '—'
  const closeTime = court.close_time?.slice(0, 5) ?? '—'
  const imgUrl    = courtImageUrl(court)
  const badge     = badgeColor(court.surface_type)

  return (
    <Link
      href={`/dashboard/court/${court.id}`}
      className="group block relative w-full max-w-[248px] rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5"
      style={{ aspectRatio: '3 / 4', minHeight: '300px' }}
    >
      {/* ── Real photo background ───────────────────────────── */}
      <img
        src={imgUrl}
        alt={court.name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />

      {/* ── Dark gradient overlay (keeps text readable) ─────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-rg-dark via-rg-dark/40 to-transparent" />

      {/* ── Subtle top shimmer ───────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.10) 0%, transparent 55%)' }}
      />

      {/* ── Surface badge ────────────────────────────────────── */}
      <div className="absolute top-3.5 left-3.5 z-10">
        <span
          className="backdrop-blur-sm border border-white/25 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize tracking-wide"
          style={{ backgroundColor: badge }}
        >
          {court.surface_type}
        </span>
      </div>

      {/* ── Aperto indicator ────────────────────────────────── */}
      <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#d54527' }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5"                           style={{ backgroundColor: '#d54527' }} />
        </span>
        <span className="text-white text-[11px] font-medium">Aperto</span>
      </div>

      {/* ── Glassmorphism footer ─────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 z-10 backdrop-blur-md bg-black/50 border-t border-white/10 px-4 py-3.5">
        <p className="text-white text-lg font-bold leading-tight tracking-tight truncate">{court.name}</p>
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <p className="text-white/55 text-xs capitalize truncate">{court.surface_type}</p>
          <p className="text-white/55 text-xs font-medium flex-shrink-0">{openTime} – {closeTime}</p>
        </div>
        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold group-hover:text-white transition-colors duration-200" style={{ color: '#d54527' }}>
          <span>Vedi orario</span>
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  )
}
