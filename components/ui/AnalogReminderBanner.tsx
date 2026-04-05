export default function AnalogReminderBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="text-base flex-shrink-0">⚠️</span>
      <p className="text-sm text-amber-800 font-medium leading-snug">
        Ricorda di verificare il <span className="font-bold">calendario cartaceo</span> per evitare sovrapposizioni analogiche.
      </p>
    </div>
  )
}
