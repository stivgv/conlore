import { login, signup } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Tennis Club
        </h1>

        <ErrorMessage searchParams={searchParams} />

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <button
              formAction={login}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              Sign In
            </button>
            <button
              formAction={signup}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 rounded-lg text-sm transition-colors"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (!params.error) return null
  return (
    <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {params.error}
    </p>
  )
}
