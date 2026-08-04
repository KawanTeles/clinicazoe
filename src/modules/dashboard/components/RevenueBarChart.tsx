"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/whatsapp";
import type { DailyStat } from "@/modules/dashboard/services/dashboard-queries";

const WIDTH = 560;
const HEIGHT = 200;
const PADDING_BOTTOM = 28;
const PADDING_TOP = 20;
const GROUP_GAP = 14;
const BAR_GAP = 2;

export function RevenueBarChart({ data }: { data: DailyStat[] }) {
  const [hovered, setHovered] = useState<{ index: number; series: "prevista" | "recebida" } | null>(
    null,
  );

  const max = Math.max(1, ...data.map((d) => Math.max(d.revenuePrevista, d.revenueRecebida)));
  const chartHeight = HEIGHT - PADDING_BOTTOM - PADDING_TOP;
  const groupWidth = (WIDTH - GROUP_GAP * (data.length - 1)) / data.length;
  const barWidth = (groupWidth - BAR_GAP) / 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-premium)" }} />
          Prevista
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-primary)" }} />
          Recebida
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Receita prevista e recebida por dia, últimos 7 dias"
        >
          <line
            x1={0}
            y1={HEIGHT - PADDING_BOTTOM}
            x2={WIDTH}
            y2={HEIGHT - PADDING_BOTTOM}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          {data.map((day, index) => {
            const groupX = index * (groupWidth + GROUP_GAP);
            const prevHeight = (day.revenuePrevista / max) * chartHeight;
            const recHeight = (day.revenueRecebida / max) * chartHeight;

            return (
              <g key={day.date}>
                <rect
                  x={groupX}
                  y={HEIGHT - PADDING_BOTTOM - prevHeight}
                  width={barWidth}
                  height={Math.max(prevHeight, 2)}
                  rx={3}
                  fill="var(--color-premium)"
                  opacity={hovered?.index === index && hovered.series === "prevista" ? 1 : 0.85}
                  onMouseEnter={() => setHovered({ index, series: "prevista" })}
                  onMouseLeave={() => setHovered(null)}
                />
                <rect
                  x={groupX + barWidth + BAR_GAP}
                  y={HEIGHT - PADDING_BOTTOM - recHeight}
                  width={barWidth}
                  height={Math.max(recHeight, 2)}
                  rx={3}
                  fill="var(--color-primary)"
                  opacity={hovered?.index === index && hovered.series === "recebida" ? 1 : 0.85}
                  onMouseEnter={() => setHovered({ index, series: "recebida" })}
                  onMouseLeave={() => setHovered(null)}
                />
                <text
                  x={groupX + groupWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--color-text-secondary)"
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute rounded-lg border border-border bg-white px-2 py-1 text-xs text-text-primary shadow-md"
            style={{
              left: `${((hovered.index * (groupWidth + GROUP_GAP) + groupWidth / 2) / WIDTH) * 100}%`,
              top: 0,
              transform: "translate(-50%, -110%)",
            }}
          >
            {hovered.series === "prevista"
              ? formatCurrency(data[hovered.index].revenuePrevista)
              : formatCurrency(data[hovered.index].revenueRecebida)}
          </div>
        )}
      </div>
    </div>
  );
}
