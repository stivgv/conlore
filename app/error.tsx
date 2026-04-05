'use client'

/**
 * Global error boundary for Next.js App Router.
 * Catches unhandled errors in any Server or Client Component in the tree,
 * displays a user-friendly message, and offers a reset button to retry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-xl font-semibold">Si è verificato un errore</h2>
      <p className="text-gray-500 text-sm">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Riprova
      </button>
    </div>
  )
}
