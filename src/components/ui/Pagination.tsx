import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

function buildHref(basePath: string, page: number, searchParams?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-xs text-text-secondary">
        Página <span className="font-semibold text-text-primary">{page}</span> de{" "}
        <span className="font-semibold text-text-primary">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(basePath, page - 1, searchParams)}
            className="inline-flex h-9 items-center rounded-xl border border-border bg-card-elevated px-4 text-xs font-semibold text-text-primary transition-all hover:border-primary/50 hover:bg-card"
          >
            Anterior
          </Link>
        ) : (
          <span className="inline-flex h-9 cursor-not-allowed items-center rounded-xl border border-border/40 bg-surface/40 px-4 text-xs font-semibold text-text-disabled">
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(basePath, page + 1, searchParams)}
            className="inline-flex h-9 items-center rounded-xl border border-border bg-card-elevated px-4 text-xs font-semibold text-text-primary transition-all hover:border-primary/50 hover:bg-card"
          >
            Próxima
          </Link>
        ) : (
          <span className="inline-flex h-9 cursor-not-allowed items-center rounded-xl border border-border/40 bg-surface/40 px-4 text-xs font-semibold text-text-disabled">
            Próxima
          </span>
        )}
      </div>
    </div>
  );
}

