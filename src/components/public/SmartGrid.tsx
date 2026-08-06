import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SmartGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  gridClassName: string;
  /** Abaixo desta contagem, os itens são centralizados em vez de esticados num grid fixo. */
  minColumns?: number;
  emptyState: ReactNode;
  className?: string;
}

/**
 * Evita buracos visuais em grids fixos (grid-cols-N) quando há poucos itens
 * cadastrados: com menos itens que minColumns, centraliza em flex-wrap; com
 * zero itens, renderiza o emptyState.
 */
export function SmartGrid<T>({
  items,
  renderItem,
  gridClassName,
  minColumns = 3,
  emptyState,
  className,
}: SmartGridProps<T>) {
  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  if (items.length < minColumns) {
    return (
      <div className={cn("flex flex-wrap justify-center gap-6", className)}>
        {items.map((item, index) => (
          <div key={index} className="w-full max-w-sm">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return <div className={cn(gridClassName, className)}>{items.map((item, index) => renderItem(item, index))}</div>;
}
