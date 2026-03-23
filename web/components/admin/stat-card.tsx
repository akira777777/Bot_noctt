import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, subtitle, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold mt-1 font-mono">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
    </div>
  );
}
