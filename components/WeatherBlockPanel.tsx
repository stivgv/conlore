'use client'

/**
 * WeatherBlockPanel — admin-only control for the "Maltempo" (bad weather) feature.
 *
 * States:
 *  - No active block → shows "Maltempo" activation button → opens 2-step modal
 *  - Active block    → shows live countdown + green "Ripristina" button
 *
 * Step flow of the modal:
 *   1. choose  — pick duration: 1 ora | 3 ore | Fine giornata
 *   2. confirm — summary + activate button
 */

import { useState, useEffect, useTransition } from 'react'
import { CloudRain, RefreshCw, AlertTriangle, X } from 'lucide-react'
import {
  activateWeatherBlock,
  deactivateWeatherBlock,
  type ActiveWeatherBlock,
} from '@/app/admin/weather-actions'

// ── Types ────────────────────────────────────────────────────────────────────

interface WeatherBlockPanelProps {
  activeBlock:    ActiveWeatherBlock | null
  affectedCount:  number              // upcoming confirmed bookings today
}

type Duration = '1h' | '3h' | 'end_of_day'
type Step     = 'choose' | 'confirm'

// ── Sub-component: live countdown ────────────────────────────────────────────

function Countdown({ blockUntil }: { blockUntil: string }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function tick() {
      const diff = new Date(blockUntil).getTime() - Date.now()
      if (diff <= 0) { setLabel('Scaduto'); return }
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

  return <span className="font-mono font-bold text-orange-600 text-sm">{label}</span>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DURATION_LABELS: Record<Duration, string> = {
  '1h':         '1 ora',
  '3h':         '3 ore',
  'end_of_day': 'Fine giornata',
}

function formatBlockUntil(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeatherBlockPanel({ activeBlock, affectedCount }: WeatherBlockPanelProps) {
  const [step,   setStep]   = useState<Step | null>(null)
  const [chosen, setChosen] = useState<Duration | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openModal()  { setStep('choose'); setChosen(null); setError(null) }
  function closeModal() { setStep(null); setChosen(null); setError(null) }

  function handleActivate() {
    if (!chosen) return
    setError(null)
    startTransition(async () => {
      const res = await activateWeatherBlock(chosen)
      if (res.status === 'error') setError(res.message)
      else closeModal()
    })
  }

  function handleDeactivate() {
    startTransition(async () => { await deactivateWeatherBlock() })
  }

  // ── Active block: show countdown + ripristino ────────────────────────────
  if (activeBlock) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Animated status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
          <span className="text-xs font-semibold text-orange-700 whitespace-nowrap">Maltempo Attivo</span>
        </div>

        {/* Live countdown */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50/60 border border-orange-100 rounded-full">
          <span className="text-[11px] text-orange-500 whitespace-nowrap">Scade tra</span>
          <Countdown blockUntil={activeBlock.block_until} />
        </div>

        {/* Ripristina button */}
        <button
          type="button"
          disabled={isPending}
          onClick={handleDeactivate}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold
            bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50
            transition-colors duration-150 whitespace-nowrap"
        >
          <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
          Ripristina
        </button>
      </div>
    )
  }

  // ── No active block: activation button + modal ───────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold
          border-2 border-sky-200 text-sky-700 bg-sky-50
          hover:border-sky-400 hover:bg-sky-100
          transition-colors duration-150 whitespace-nowrap"
      >
        <CloudRain size={14} />
        Maltempo
      </button>

      {/* ── Modal overlay ─────────────────────────────────────────────────── */}
      {step && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div className="bg-sky-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <CloudRain size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">Blocco Maltempo</h3>
                  <p className="text-sky-100 text-xs">Sospendi le prenotazioni online</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Step 1: choose duration ──────────────────────────────────── */}
            {step === 'choose' && (
              <div className="p-6 space-y-5">
                <p className="text-sm text-gray-600">
                  Per quante ore vuoi bloccare le prenotazioni online?
                </p>

                {/* Affected bookings warning */}
                {affectedCount > 0 && (
                  <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Ci sono{' '}
                      <span className="font-semibold">{affectedCount} prenotazioni</span>{' '}
                      confermate nelle prossime ore. Dopo l'attivazione avvisa i soci interessati.
                    </p>
                  </div>
                )}

                {/* Duration selector */}
                <div className="grid grid-cols-3 gap-3">
                  {(['1h', '3h', 'end_of_day'] as Duration[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setChosen(d)}
                      className={[
                        'p-4 rounded-xl border-2 text-center transition-all duration-150',
                        chosen === d
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-gray-200 hover:border-sky-200 bg-white',
                      ].join(' ')}
                    >
                      <span className={`block text-sm font-bold ${chosen === d ? 'text-sky-700' : 'text-gray-700'}`}>
                        {d === '1h' ? '1 ora' : d === '3h' ? '3 ore' : 'Fino a'}
                      </span>
                      {d === 'end_of_day' && (
                        <span className={`block text-[11px] mt-0.5 ${chosen === d ? 'text-sky-500' : 'text-gray-400'}`}>
                          fine giornata
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={!chosen}
                    onClick={() => setStep('confirm')}
                    className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold
                      disabled:opacity-40 hover:bg-sky-700 transition-colors"
                  >
                    Continua →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: confirm ───────────────────────────────────────────── */}
            {step === 'confirm' && chosen && (
              <div className="p-6 space-y-5">
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                  <p className="text-sm font-semibold text-sky-900">
                    Blocco:{' '}
                    <span className="text-sky-700">{DURATION_LABELS[chosen]}</span>
                  </p>
                  <p className="text-xs text-sky-700">
                    I soci vedranno un avviso di maltempo e non potranno prenotare online
                    durante il blocco. Il banner scomparirà automaticamente allo scadere.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('choose')}
                    disabled={isPending}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    ← Indietro
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleActivate}
                    className="flex-1 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold
                      disabled:opacity-50 hover:bg-sky-700 transition-colors
                      flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <><RefreshCw size={14} className="animate-spin" /> Attivazione...</>
                    ) : (
                      <><CloudRain size={14} /> Attiva Blocco</>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
