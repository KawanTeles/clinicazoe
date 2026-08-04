export interface GeneratedInstance {
  startTime: string;
  endTime: string;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Divide uma janela larga (ex. 08:00–12:00) em instâncias agendáveis pela duração da consulta. */
export function generateSlotInstances(
  windowStart: string,
  windowEnd: string,
  durationMinutes: number,
): GeneratedInstance[] {
  const startMin = toMinutes(windowStart);
  const endMin = toMinutes(windowEnd);
  const instances: GeneratedInstance[] = [];

  for (let t = startMin; t + durationMinutes <= endMin; t += durationMinutes) {
    instances.push({ startTime: toTimeStr(t), endTime: toTimeStr(t + durationMinutes) });
  }

  return instances;
}

/** Remove instâncias cuja quantidade de vagas já foi atingida. */
export function filterAvailableInstances(
  instances: GeneratedInstance[],
  capacity: number,
  bookedCountByStartTime: Record<string, number>,
): GeneratedInstance[] {
  return instances.filter((instance) => (bookedCountByStartTime[instance.startTime] ?? 0) < capacity);
}
