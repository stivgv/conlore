'use client'

/**
 * WeatherBanner — shown to members on the dashboard when a weather block is active.
 *
 * Features:
 *  - Live countdown until the block expires
 *  - "Prova a prenotare" → smooth-scrolls to the schedule grid
 *  - "Chiama Segreteria" → tel: link (tap-to-call on mobile)
 *  - Copy phone number to clipboard button
 */

import { useState, useEffect } from 'react'
import { CloudRain, Phone, Copy, Check } from 'lucide-react'
import type { ActiveWeatherBlock } from '@/app/admin/weather-actions'

// ─── Configure your club's secretary phone number here ───────────────────────
const SEGRETERIA_PHONE = '+39 0000 000000'
// ─────────────────────────────────────────────────────────────────────────────

interface WeatherBannerProps {
  activeBlock: ActiveWeatherBlock
}

function Countdown({ blockUntil }: { blockUntil: string }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function tick() {
      const diff = new Date(blockUntil).getTime() - Date.now()
      if (diff <= 0) { setLabel('in scadenza'); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setLabel(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
          : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
      )
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [blockUntil])

  return <span className="font-mono font-bold">{label}</span>
}

export default function WeatherBanner({ activeBlock }: WeatherBannerProps) {
  const [copied, setCopied] = useState(false)

  function copyPhone() {
    navigator.clipboard.writeText(SEGRETERIA_PHONE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    })
  }

  const blockUntilFormatted = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(activeBlock.block_until))

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-sky-200 bg-gradient-to-r from-sky-50 to-blue-50 shadow-sm">

      {/* Top accent strip */}
      <div className="h-1 bg-gradient-to-r from-sky-400 to-blue-500" />

      <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4">

        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center flex-shrink-0">
            <CloudRain size={20} className="text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-sky-900">Campi temporaneamente inagibili</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-sky-100 border border-sky-200 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-sky-700 uppercase tracking-wide">Maltempo</span>
              </span>
            </div>
            <p className="text-xs text-sky-700/80 mt-0.5">
              Prenotazioni online sospese fino alle{' '}
              <span className="font-semibold">{blockUntilFormatted}</span>
              {' · '}ancora{' '}
              <Countdown blockUntil={activeBlock.block_until} />
            </p>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap gap-2">

          {/* Call segreteria */}
          <a
            href={`tel:${SEGRETERIA_PHONE.replace(/\s/g, '')}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              bg-sky-600 text-white text-xs font-semibold
              hover:bg-sky-700 transition-colors duration-150"
          >
            <Phone size={13} />
            Chiama Segreteria
          </a>

          {/* Copy phone */}
          <button
            type="button"
            onClick={copyPhone}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              bg-white border border-sky-200 text-sky-700 text-xs font-semibold
              hover:border-sky-400 hover:bg-sky-50 transition-colors duration-150"
          >
            {copied
              ? <><Check size={13} className="text-emerald-600" /><span className="text-emerald-600">Copiato!</span></>
              : <><Copy size={13} />{SEGRETERIA_PHONE}</>
            }
          </button>

        </div>
      </div>
    </div>
  )
}
