import Link from "next/link";
import { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
  className?: string;
}

/**
 * Generaliza o padrão de empty-state já usado em src/app/cliente/page.tsx
 * (lista de consultas vazia) para as listagens públicas (especialidades,
 * profissionais, convênios) quando não há nenhum item cadastrado.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed bg-card-elevated/40 px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{description}</p>
      {action && (
        <div className="mt-6">
          <Link href={action.href}>
            <Button size="sm">{action.label}</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
