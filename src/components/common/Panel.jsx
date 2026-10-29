// Reusable dark panel container with an optional title and icon.

export default function Panel({ title, icon: Icon, actions, children, className = '' }) {
  return (
    <section className={`bg-panel border border-line rounded-xl ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} className="text-accent" />}
            {title && <h2 className="text-sm font-semibold tracking-wide">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}
