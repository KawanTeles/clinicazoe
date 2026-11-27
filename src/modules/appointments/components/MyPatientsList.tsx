"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProfessionalPatientView } from "@/modules/appointments/services/patient-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function MyPatientsList({ patients }: { patients: ProfessionalPatientView[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((p) => p.fullName.toLowerCase().includes(term));
  }, [patients, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          inputMode="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente por nome..."
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-3.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
          {patients.length === 0 ? "Nenhum paciente ainda." : "Nenhum paciente encontrado."}
        </div>
      ) : (
        <>
          {/* Cards — mobile/tablet */}
          <ul className="flex flex-col gap-2.5 sm:hidden">
            {filtered.map((patient) => (
              <li key={patient.patientId}>
                <Link
                  href={`/my-patients/${patient.patientId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card active:border-primary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text-primary">{patient.fullName}</p>
                    <p className="truncate text-xs text-text-secondary">{patient.phone || "Sem telefone"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-[var(--link)]">
                      {patient.appointmentCount} {patient.appointmentCount === 1 ? "atendimento" : "atendimentos"}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {dateFormatter.format(new Date(`${patient.lastAppointmentDate}T00:00:00`))}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tabela — desktop */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card sm:block">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-5 py-4 font-bold">Nome</th>
                  <th className="px-5 py-4 font-bold">Telefone</th>
                  <th className="px-5 py-4 font-bold">Último atendimento</th>
                  <th className="px-5 py-4 font-bold">Total de atendimentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((patient) => (
                  <tr key={patient.patientId} className="transition-colors hover:bg-surface/50">
                    <td className="px-5 py-4 font-semibold text-text-primary">
                      <Link href={`/my-patients/${patient.patientId}`} className="hover:text-primary hover:underline">
                        {patient.fullName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-text-secondary">{patient.phone || "—"}</td>
                    <td className="px-5 py-4 text-text-secondary">
                      {dateFormatter.format(new Date(`${patient.lastAppointmentDate}T00:00:00`))}
                    </td>
                    <td className="px-5 py-4 font-semibold text-[var(--link)]">{patient.appointmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
