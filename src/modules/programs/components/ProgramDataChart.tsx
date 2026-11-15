"use client";

import { useState } from "react";
import type { ProgramDataSessionView } from "@/modules/programs/services/program-queries";

const WIDTH = 640;
const HEIGHT = 200;
const PADDING_BOTTOM = 28;
const PADDING_TOP = 20;
const PADDING_X = 16;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function independencePercent(session: ProgramDataSessionView): number {
  const total =
    session.independentCount +
    session.verbalPromptCount +
    session.gesturalPromptCount +
    session.physicalPromptCount +
    session.incorrectCount;
  return total === 0 ? 0 : Math.round((session.independentCount / total) * 100);
}

/** Gráfico de % de independência por sessão — SVG desenhado à mão, mesmo
 * padrão de AppointmentsBarChart/RevenueBarChart (sem biblioteca de
 * gráficos: o projeto não usa nenhuma, e um gráfico de linha simples não
 * justifica adicionar uma). */
export function ProgramDataChart({ sessions }: { sessions: ProgramDataSessionView[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-border text-xs text-text-muted">
        Ainda sem sessões registradas para este programa.
      </div>
    );
  }

  const chartWidth = WIDTH - PADDING_X * 2;
  const chartHeight = HEIGHT - PADDING_BOTTOM - PADDING_TOP;
  const points = sessions.map((session, index) => {
    const x = sessions.length === 1 ? PADDING_X + chartWidth / 2 : PADDING_X + (index / (sessions.length - 1)) * chartWidth;
    const pct = independencePercent(session);
    const y = PADDING_TOP + chartHeight - (pct / 100) * chartHeight;
    return { x, y, pct, session };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Porcentagem de independência por sessão">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = PADDING_TOP + chartHeight - (tick / 100) * chartHeight;
          return (
            <g key={tick}>
              <line x1={PADDING_X} y1={y} x2={WIDTH - PADDING_X} y2={y} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={2} y={y + 3} fontSize="9" fill="var(--text-muted)">
                {tick}%
              </text>
            </g>
          );
        })}

        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} />

        {points.map((p, index) => (
          <g key={p.session.id} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
            <circle cx={p.x} cy={p.y} r={hovered === index ? 6 : 4} fill="var(--accent)" className="cursor-pointer transition-all" />
            <circle cx={p.x} cy={p.y} r={10} fill="transparent" className="cursor-pointer" />
            <text x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
              {dateFormatter.format(new Date(`${p.session.sessionDate}T00:00:00`))}
            </text>
          </g>
        ))}
      </svg>
      {hovered !== null && (
        <div
          className="pointer-events-none absolute rounded-xl border border-border bg-card-elevated px-3 py-1.5 text-xs font-semibold text-text-primary shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
          style={{
            left: `${(points[hovered].x / WIDTH) * 100}%`,
            top: 0,
            transform: "translate(-50%, -110%)",
          }}
        >
          {points[hovered].pct}% independente · {dateFormatter.format(new Date(`${points[hovered].session.sessionDate}T00:00:00`))}
        </div>
      )}
    </div>
  );
}
