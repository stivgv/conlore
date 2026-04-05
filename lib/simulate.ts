import { cookies } from 'next/headers'

export type SimulatedRole = 'member' | 'teacher'

/**
 * Returns the role currently being simulated by an admin, or null.
 * Reads from the 'tc_simulate' cookie set by ProfileSimulator.
 */
export async function getSimulatedRole(): Promise<SimulatedRole | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('tc_simulate')?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    const role = parsed?.role
    if (role === 'member' || role === 'teacher') return role
    return null
  } catch {
    return null
  }
}
