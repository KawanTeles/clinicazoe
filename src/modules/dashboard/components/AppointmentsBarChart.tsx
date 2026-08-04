"use client";

import { useState } from "react";
import type { DailyStat } from "@/modules/dashboard/services/dashboard-queries";

const WIDTH = 560;
const HEIGHT = 180;
const PADDING_BOTTOM = 28;
const PADDING_TOP = 20;
const BAR_GAP = 10;

export function AppointmentsBarChart({ data }: { data: DailyStat[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.appointments));
  const chartHeight = HEIGHT - PADDING_BOTTOM - PADDING_TOP;
  const barWidth = (WIDTH - BAR_GAP * (data.length - 1)) / data.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Consultas por dia, últimos 7 dias">
        <line
          x1={0}
          y1={HEIGHT - PADDING_BOTTOM}
          x2={WIDTH}
          y2={HEIGHT - PADDING_BOTTOM}
          stroke="#255044"
          strokeWidth={1}
        />
        {data.map((day, index) => {
          const barHeight = (day.appointments / max) * chartHeight;
          const x = index * (barWidth + BAR_GAP);
          const y = HEIGHT - PADDING_BOTTOM - barHeight;
          const isHovered = hovered === index;

          return (
            <g
              key={day.date}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={6}
                fill={isHovered ? "#5ED39D" : "#2E8B57"}
                opacity={isHovered ? 1 : 0.85}
              />
              {day.appointments > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#F5F7F6"
                >
                  {day.appointments}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#C8D4CF"
              >
                {day.label}
              </text>
              <rect
                x={x}
                y={PADDING_TOP}
                width={barWidth}
                height={chartHeight}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>
      {hovered !== null && (
        <div
          className="pointer-events-none absolute rounded-xl border border-[#255044] bg-[#17382D] px-3 py-1.5 text-xs font-semibold text-[#F5F7F6] shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
          style={{
            left: `${((hovered * (barWidth + BAR_GAP) + barWidth / 2) / WIDTH) * 100}%`,
            top: 0,
            transform: "translate(-50%, -110%)",
          }}
        >
          {data[hovered].appointments} consulta{data[hovered].appointments === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

