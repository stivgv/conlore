'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  status: 'idle' | 'error'
  message?: string
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email:    (formData.get('email')    as string).trim(),
    password:  formData.get('password') as string,
  })

  if (error) return { status: 'error', message: 'Email o password non corretti.' }

  redirect('/dashboard')
}

export async function signup(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const firstName = (formData.get('first_name') as string ?? '').trim()
  const lastName  = (formData.get('last_name')  as string ?? '').trim()
  const email     = (formData.get('email')       as string ?? '').trim()
  const phone     = (formData.get('phone')       as string ?? '').trim()
  const password  =  formData.get('password')    as string ?? ''
  const confirm   =  formData.get('password_confirm') as string ?? ''

  // ── Validations ──────────────────────────────────────────────────────────
  if (!firstName || !lastName)
    return { status: 'error', message: 'Nome e cognome sono obbligatori.' }

  if (!phone || !/^\+?[\d\s\-]{7,15}$/.test(phone))
    return { status: 'error', message: 'Inserisci un numero di cellulare valido.' }

  if (password.length < 8)
    return { status: 'error', message: 'La password deve contenere almeno 8 caratteri.' }

  if (password !== confirm)
    return { status: 'error', message: 'Le password non coincidono.' }

  const fullName = `${firstName} ${lastName}`

  // ── Supabase Auth sign-up ─────────────────────────────────────────────────
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
    },
  })

  if (error) {
    const msg = error.message.toLowerCase().includes('already')
      ? 'Questa email è già registrata. Prova ad accedere.'
      : 'Registrazione non riuscita. Riprova.'
    return { status: 'error', message: msg }
  }

  // ── Persist name & phone in public.users ─────────────────────────────────
  // The trigger (handle_new_user) creates the row; we update it with the full data.
  if (data.user) {
    await supabase
      .from('users')
      .update({ name: fullName, phone })
      .eq('id', data.user.id)
  }

  redirect('/dashboard')
}
