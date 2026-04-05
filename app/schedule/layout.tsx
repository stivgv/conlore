import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/AppNavbar'

export default async function ScheduleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  return (
    <div className="min-h-screen bg-white">
      <AppNavbar />
      {children}
    </div>
  )
}
