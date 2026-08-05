"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import {
  searchPatientsForBooking,
  type PatientSearchResult,
} from "@/modules/patients/services/patient-actions";

interface PatientPickerFieldProps {
  onSelect: (patient: PatientSearchResult) => void;
  selectedName?: string | null;
}

export function PatientPickerField({ onSelect, selectedName }: PatientPickerFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      const data = await searchPatientsForBooking(query);
      setResults(data);
      setOpen(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <Input
        label="Paciente"
        placeholder="Buscar por nome ou telefone..."
        value={selectedName ? selectedName : query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (next.trim().length < 2) {
            setResults([]);
            setOpen(false);
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card-hover">
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => {
                onSelect(patient);
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm hover:bg-surface/60"
            >
              <span className="font-semibold text-text-primary">{patient.fullName}</span>
              <span className="text-xs text-text-secondary">{patient.phone || "Sem telefone"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
