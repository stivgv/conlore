import Link from 'next/link'
import type { Court } from '@/types/database'

// Detect surface category from any DB surface_type string
function surfaceCategory(raw: string): 'clay' | 'hard' | 'grass' | 'indoor' {
  const s = raw.toLowerCase().replace(/[\s_-]+/g, '')
  if (s.includes('clay') || s.includes('terra') || s.includes('rossa') || s.includes('argilla')) return 'clay'
  if (s.includes('hard') || s.includes('cemento') || s.includes('resina') || s.includes('concr'))  return 'hard'
  if (s.includes('grass') || s.includes('erba')) return 'grass'
  return 'indoor'
}

type SurfaceStyle = {
  bg: string
  bgImage: string
  bgSize?: string
  bgPos?: string
  badgeColor: string
}

const SURFACE_STYLES: Record<string, SurfaceStyle> = {
  clay: {
    bg:         '#b83820',
    bgImage:    'linear-gradient(160deg,#6b1a08 0%,#b83820 40%,#e05232 75%,#c84428 100%)',
    badgeColor: '#d54527',
  },
  hard: {
    bg:         '#1a3060',
    bgImage:    "url('/courts/campo-hard.png')",
    bgSize:     'cover',
    bgPos:      'center',
    badgeColor: '#2e5ca8',
  },
  grass: {
    bg:         '#1a4018',
    bgImage:    'linear-gradient(160deg,#0f2010 0%,#1a4018 45%,#2e7a28 100%)',
    badgeColor: '#2e7a28',
  },
  indoor: {
    bg:         '#4a3f10',
    bgImage:    'linear-gradient(160deg,#1a1608 0%,#4a3f10 45%,#9a8730 100%)',
    badgeColor: '#9a8730',
  },
}

export default function CourtCard({ court }: { court: Court }) {
  const cat   = surfaceCategory(court.surface_type)
  const st    = SURFACE_STYLES[cat] ?? SURFACE_STYLES.indoor
  const openTime  = court.open_time?.slice(0, 5)  ?? '—'
  const closeTime = court.close_time?.slice(0, 5) ?? '—'

  return (
    <Link
      href={`/dashboard/court/${court.id}`}
      className="group block relative w-full max-w-[248px] rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5"
      style={{ aspectRatio: '3 / 4', minHeight: '300px' }}
    >
      {/* ── Background (image or gradient) ────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor:    st.bg,
          backgroundImage:    st.bgImage,
          backgroundSize:     st.bgSize  ?? 'auto',
          backgroundPosition: st.bgPos   ?? 'center',
          backgroundRepeat:   'no-repeat',
        }}
      />

      {/* Highlight shimmer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.14) 0%, transparent 55%)' }}
      />

      {/* Footer darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.10) 45%, transparent 100%)' }}
      />

      {/* Surface badge */}
      <div className="absolute top-3.5 left-3.5 z-10">
        <span
          className="backdrop-blur-sm border border-white/25 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize tracking-wide"
          style={{ backgroundColor: st.badgeColor + 'cc' }}
        >
          {court.surface_type}
        </span>
      </div>

      {/* Aperto indicator */}
      <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#d54527' }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5"                           style={{ backgroundColor: '#d54527' }} />
        </span>
        <span className="text-white text-[11px] font-medium">Aperto</span>
      </div>

      {/* Glassmorphism footer */}
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
