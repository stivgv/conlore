'use client'

import { useActionState, useState } from 'react'
import { login, signup, type AuthState } from './actions'
import { Eye, EyeOff } from 'lucide-react'

const idle: AuthState = { status: 'idle' }

// ─── Shared input style ─────────────────────────────────────────────────────
const inputCls =
  'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-rg-clay focus:ring-1 focus:ring-rg-clay/30 transition-colors bg-white placeholder:text-gray-300'

// ─── Field ──────────────────────────────────────────────────────────────────

function Field({
  label, name, type = 'text', placeholder, required = true, autoComplete,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-semibold text-gray-600">
        {label}
        {required && <span className="text-rg-clay ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={isPassword ? (show ? 'text' : 'password') : type}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={inputCls}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Login form ─────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, action, pending] = useActionState(login, idle)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === 'error' && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
          {state.message}
        </p>
      )}

      <Field label="Email"    name="email"    type="email"    placeholder="mario@esempio.it" autoComplete="email" />
      <Field label="Password" name="password" type="password" placeholder="••••••••"         autoComplete="current-password" />

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rg-dark text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-rg-clay transition-colors disabled:opacity-60 mt-1"
      >
        {pending ? 'Accesso in corso…' : 'Accedi'}
      </button>

      <p className="text-center text-xs text-gray-400">
        Non hai un account?{' '}
        <button type="button" onClick={onSwitch} className="text-rg-clay font-semibold hover:underline">
          Registrati
        </button>
      </p>
    </form>
  )
}

// ─── Signup form ────────────────────────────────────────────────────────────

function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const [state, action, pending] = useActionState(signup, idle)

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.status === 'error' && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome"    name="first_name" placeholder="Mario"  autoComplete="given-name" />
        <Field label="Cognome" name="last_name"  placeholder="Rossi"  autoComplete="family-name" />
      </div>

      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="mario@esempio.it"
        autoComplete="email"
      />

      <Field
        label="Cellulare"
        name="phone"
        type="tel"
        placeholder="333 1234567"
        autoComplete="tel"
      />

      <Field
        label="Password"
        name="password"
        type="password"
        placeholder="Min. 8 caratteri"
        autoComplete="new-password"
      />

      <Field
        label="Conferma password"
        name="password_confirm"
        type="password"
        placeholder="Ripeti la password"
        autoComplete="new-password"
      />

      <p className="text-[11px] text-gray-400 leading-snug">
        I tuoi dati sono usati esclusivamente per gestire le prenotazioni del club.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rg-dark text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-rg-clay transition-colors disabled:opacity-60 mt-1"
      >
        {pending ? 'Registrazione in corso…' : 'Crea account'}
      </button>

      <p className="text-center text-xs text-gray-400">
        Hai già un account?{' '}
        <button type="button" onClick={onSwitch} className="text-rg-clay font-semibold hover:underline">
          Accedi
        </button>
      </p>
    </form>
  )
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function LoginFormClient({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  return (
    <div className="w-full max-w-sm">

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 text-center">
          <div className="w-12 h-12 rounded-xl bg-rg-dark flex items-center justify-center mx-auto mb-3 shadow-sm">
            <span className="text-xl">🎾</span>
          </div>
          <h1 className="text-xl font-bold text-rg-dark">Tennis Club</h1>
          <p className="text-xs text-gray-400 mt-1">
            {mode === 'login' ? 'Accedi al tuo account' : 'Crea il tuo account socio'}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-gray-100">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                'flex-1 py-3 text-xs font-semibold transition-colors border-b-2',
                mode === m
                  ? 'border-rg-clay text-rg-clay'
                  : 'border-transparent text-gray-400 hover:text-gray-700',
              ].join(' ')}
            >
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        {/* Form area */}
        <div className="px-8 py-6">
          {/* Error from URL (legacy redirect errors) */}
          {initialError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
              {initialError}
            </p>
          )}

          {mode === 'login'
            ? <LoginForm  onSwitch={() => setMode('signup')} />
            : <SignupForm onSwitch={() => setMode('login')}  />
          }
        </div>
      </div>
    </div>
  )
}
