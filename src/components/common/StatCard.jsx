// Compact metric card used across the live metrics panel.

export default function StatCard({ label, value, unit, accent = 'text-signal-green' }) {
  return (
    <div className="bg-panel-2 border border-line rounded-lg px-3 py-2.5">
      <div className={`text-lg font-bold leading-none ${accent}`}>
        {value}
        {unit && <span className="text-xs font-medium text-muted ml-0.5">{unit}</span>}
      </div>
      <div className="text-[11px] text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}
