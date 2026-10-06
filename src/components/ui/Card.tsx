export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-card border border-base-border bg-base-surface p-5 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
