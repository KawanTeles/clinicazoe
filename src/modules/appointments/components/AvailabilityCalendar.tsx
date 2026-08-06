"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { toLocalIsoDate } from "@/lib/date";
import {
  getMonthAvailability,
  type DayAvailability,
  type DayAvailabilityStatus,
} from "@/modules/appointments/services/booking-queries";
import type { Modality } from "@/lib/supabase/types";

const WEEKDAY_HEADER = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

const LEGEND: { status: DayAvailabilityStatus; label: string; swatch: string }[] = [
  { status: "available", label: "Disponível", swatch: "bg-primary" },
  { status: "full", label: "Lotado", swatch: "bg-[#F59E0B]" },
  { status: "blocked", label: "Bloqueado", swatch: "bg-[#DC2626]" },
  { status: "no-schedule", label: "Sem expediente", swatch: "bg-[#94A3B8]" },
];

const CELL_CLASSES: Record<DayAvailabilityStatus, string> = {
  available: "border-primary/50 bg-primary/10 text-text-primary hover:border-primary hover:bg-primary/20 cursor-pointer",
  full: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#B45309] dark:text-[#F59E0B] cursor-not-allowed",
  blocked: "border-[#DC2626]/30 bg-[#DC2626]/5 text-[#DC2626]/80 cursor-not-allowed",
  "no-schedule": "border-border/50 bg-card-elevated/30 text-text-muted cursor-not-allowed",
  past: "border-transparent text-text-muted/40 cursor-not-allowed",
};

export interface AvailabilityCalendarProps {
  professionalId: string;
  insuranceId: string;
  selectedDate: string | null;
  onSelectDate: (day: DayAvailability) => void;
  modality?: Modality;
}

export function AvailabilityCalendar({
  professionalId,
  insuranceId,
  selectedDate,
  onSelectDate,
  modality,
}: AvailabilityCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMonthAvailability(professionalId, insuranceId, cursor.year, cursor.month, modality).then((data) => {
      if (!cancelled) {
        setDays(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [professionalId, insuranceId, cursor.year, cursor.month, modality]);

  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, i) => i);
  const monthLabel = MONTH_FORMATTER.format(new Date(cursor.year, cursor.month - 1, 1));

  const todayIso = toLocalIsoDate(today);
  const canGoBack = !(cursor.year === today.getFullYear() && cursor.month === today.getMonth() + 1);

  function goToMonth(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          disabled={!canGoBack}
          aria-label="Mês anterior"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-secondary hover:border-primary/50 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        <span className="text-xs font-bold uppercase tracking-wide text-text-primary">{monthLabel}</span>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label="Próximo mês"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-secondary hover:border-primary/50 hover:text-primary"
        >
          ›
        </button>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_HEADER.map((w) => (
            <span key={w} className="text-center text-[10px] font-bold uppercase text-text-muted">
              {w}
            </span>
          ))}
          {leadingBlanks.map((i) => (
            <span key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const isSelected = selectedDate === day.date;
            const isToday = day.date === todayIso;
            const clickable = day.status === "available" || day.status === "full";
            return (
              <button
                key={day.date}
                type="button"
                title={day.reason}
                disabled={!clickable}
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex h-9 flex-col items-center justify-center rounded-md border text-xs font-semibold transition-all",
                  CELL_CLASSES[day.status],
                  isSelected && "!border-primary !bg-primary !text-white font-bold shadow-xs",
                  isToday && !isSelected && "ring-1 ring-primary/40",
                )}
              >
                {Number(day.date.slice(8, 10))}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {LEGEND.map((item) => (
          <span key={item.status} className="flex items-center gap-1.5 text-[10px] font-semibold text-text-secondary">
            <span className={cn("h-2 w-2 rounded-full", item.swatch)} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
