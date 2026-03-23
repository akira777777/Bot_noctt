import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, subtitle, className }: StatCardProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-6 transition-all hover:shadow-lg", className)}
      role="region"
      aria-labelledby={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <h3 id={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-muted-foreground">{title}</h3>
      <p className="text-3xl font-bold mt-1 font-mono">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
    </div>
  );
}
