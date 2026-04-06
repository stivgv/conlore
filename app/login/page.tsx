import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginFormClient from './LoginFormClient'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // Redirect already-authenticated users directly to the dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const params = await searchParams
  const initialError = params.error ? decodeURIComponent(params.error) : undefined

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <LoginFormClient initialError={initialError} />
    </main>
  )
}
