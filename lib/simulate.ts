import { cookies } from 'next/headers'

export interface SimulatedProfile {
  id:         string
  name:       string
  email:      string
  role:       'admin' | 'member' | 'teacher'
  color_code: string | null
}

/**
 * Returns the profile currently being simulated by an admin, or null.
 * Reads from the 'tc_simulate' cookie set by ProfileSimulator.
 */
export async function getSimulatedProfile(): Promise<SimulatedProfile | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('tc_simulate')?.value
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw)) as SimulatedProfile
  } catch {
    return null
  }
}
