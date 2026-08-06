"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { updateClinicBusinessHours } from "@/modules/settings/services/settings-actions";
import { WEEKDAY_LABELS, type ClinicSettingsFormState } from "@/modules/settings/utils/form-state";
import type { BusinessHourEntry } from "@/lib/supabase/types";

interface BusinessHoursCardProps {
  data: ClinicSettingsFormState;
  onChange: (patch: Partial<ClinicSettingsFormState>) => void;
  readOnly: boolean;
}

export function BusinessHoursCard({ data, onChange, readOnly }: BusinessHoursCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function updateDay(day: number, patch: Partial<BusinessHourEntry>) {
    onChange({
      business_hours: data.business_hours.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)),
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateClinicBusinessHours({
      business_hours: data.business_hours,
      holiday_open: data.holiday_open,
      holiday_open_time: data.holiday_open_time,
      holiday_close_time: data.holiday_close_time,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Horário de funcionamento salvo." });
    router.refresh();
  }

  const sortedHours = [...data.business_hours].sort((a, b) => a.day - b.day);

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="py-3.5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          🕒 Horário de Funcionamento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            {sortedHours.map((entry) => (
              <div
                key={entry.day}
                className="grid grid-cols-1 items-center gap-2.5 rounded-xl border border-border/60 bg-card-elevated/40 p-3 sm:grid-cols-[1fr_120px_120px]"
              >
                <Switch
                  checked={entry.is_open}
                  disabled={readOnly}
                  onChange={(checked) => updateDay(entry.day, { is_open: checked })}
                  label={WEEKDAY_LABELS[entry.day]}
                />
                {entry.is_open ? (
                  <>
                    <Input
                      type="time"
                      value={entry.open_time}
                      disabled={readOnly}
                      onChange={(e) => updateDay(entry.day, { open_time: e.target.value })}
                    />
                    <Input
                      type="time"
                      value={entry.close_time}
                      disabled={readOnly}
                      onChange={(e) => updateDay(entry.day, { close_time: e.target.value })}
                    />
                  </>
                ) : (
                  <span className="text-xs font-semibold text-text-muted sm:col-span-2 sm:text-right">Fechado</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card-elevated/40 p-3">
            <Switch
              checked={data.holiday_open}
              disabled={readOnly}
              onChange={(checked) => onChange({ holiday_open: checked })}
              label="Abre em feriados"
            />
            {data.holiday_open ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Abertura"
                  type="time"
                  value={data.holiday_open_time}
                  disabled={readOnly}
                  onChange={(e) => onChange({ holiday_open_time: e.target.value })}
                />
                <Input
                  label="Fechamento"
                  type="time"
                  value={data.holiday_close_time}
                  disabled={readOnly}
                  onChange={(e) => onChange({ holiday_close_time: e.target.value })}
                />
              </div>
            ) : (
              <span className="text-xs font-semibold text-text-muted">Fechado em feriados</span>
            )}
          </div>
        </div>

        {message && (
          <p className={message.type === "success" ? "text-xs font-semibold text-success animate-fade-in" : "text-xs font-semibold text-danger animate-fade-in"}>
            {message.text}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button size="sm" isLoading={saving} onClick={handleSave} className="px-5 font-bold">
              Salvar Horário
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

