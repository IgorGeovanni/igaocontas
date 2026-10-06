import { ToggleValuesButton } from "@/components/finance/ToggleValuesButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="no-print mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ToggleValuesButton />
      </div>
    </div>
  );
}
