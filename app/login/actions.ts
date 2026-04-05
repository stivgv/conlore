'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    // Use a generic message to prevent user enumeration via Supabase error details
    redirect(`/login?error=${encodeURIComponent('Email o password non corretti')}`)
  }

  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    // Use a generic message to prevent user enumeration via Supabase error details
    redirect(`/login?error=${encodeURIComponent('Registrazione non riuscita. Riprova.')}`)
  }

  redirect('/dashboard')
}
