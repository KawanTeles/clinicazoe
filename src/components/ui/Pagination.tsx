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
      <p className="text-xs text-[#C8D4CF]">
        Página <span className="font-semibold text-[#F5F7F6]">{page}</span> de{" "}
        <span className="font-semibold text-[#F5F7F6]">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(basePath, page - 1, searchParams)}
            className="inline-flex h-9 items-center rounded-xl border border-[#255044] bg-[#17382D] px-4 text-xs font-semibold text-[#F5F7F6] transition-all hover:border-[#2E8B57]/50 hover:bg-[#102A22]"
          >
            Anterior
          </Link>
        ) : (
          <span className="inline-flex h-9 cursor-not-allowed items-center rounded-xl border border-[#255044]/40 bg-[#17382D]/40 px-4 text-xs font-semibold text-[#7A9187]">
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(basePath, page + 1, searchParams)}
            className="inline-flex h-9 items-center rounded-xl border border-[#255044] bg-[#17382D] px-4 text-xs font-semibold text-[#F5F7F6] transition-all hover:border-[#2E8B57]/50 hover:bg-[#102A22]"
          >
            Próxima
          </Link>
        ) : (
          <span className="inline-flex h-9 cursor-not-allowed items-center rounded-xl border border-[#255044]/40 bg-[#17382D]/40 px-4 text-xs font-semibold text-[#7A9187]">
            Próxima
          </span>
        )}
      </div>
    </div>
  );
}

