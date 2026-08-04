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
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-text-secondary">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(basePath, page - 1, searchParams)}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm font-medium text-text-primary hover:bg-bg-soft"
          >
            Anterior
          </Link>
        ) : (
          <span className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-border px-3 text-sm font-medium text-text-secondary/50">
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(basePath, page + 1, searchParams)}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm font-medium text-text-primary hover:bg-bg-soft"
          >
            Próxima
          </Link>
        ) : (
          <span className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-border px-3 text-sm font-medium text-text-secondary/50">
            Próxima
          </span>
        )}
      </div>
    </div>
  );
}
