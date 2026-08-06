import { Breadcrumb, type BreadcrumbItem } from "@/components/public/Breadcrumb";

interface PageHeroProps {
  breadcrumbItems: BreadcrumbItem[];
  title: string;
  subtitle?: string;
}

/**
 * Hero padrão das páginas internas: breadcrumb + h1 + subtítulo, sem o Badge
 * "premium" (reservado para a Home, ver src/app/page.tsx). Renderizado sem
 * ScrollReveal de propósito — é o conteúdo mais provável de ser o LCP de cada
 * rota interna e não deve depender de IntersectionObserver para aparecer.
 */
export function PageHero({ breadcrumbItems, title, subtitle }: PageHeroProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 text-center">
      <Breadcrumb items={breadcrumbItems} className="justify-center" />
      <h1 className="tracking-hero mt-2 text-3xl font-black leading-[1.15] text-text-primary sm:text-5xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
          {subtitle}
        </p>
      )}
    </div>
  );
}
