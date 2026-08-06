"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  searchPatientsForBooking,
  type PatientSearchResult,
} from "@/modules/patients/services/patient-actions";

interface PatientPickerFieldProps {
  onSelect: (patient: PatientSearchResult) => void;
  onClear?: () => void;
  selectedName?: string | null;
  selectedPhone?: string | null;
}

export function PatientPickerField({
  onSelect,
  onClear,
  selectedName,
  selectedPhone,
}: PatientPickerFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchResults(search: string) {
    setLoading(true);
    try {
      const data = await searchPatientsForBooking(search);
      setResults(data);
      setHighlighted(-1);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchResults(query);
    }, query.trim().length === 0 ? 0 : 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleFocus() {
    setOpen(true);
  }

  function handleSelect(patient: PatientSearchResult) {
    onSelect(patient);
    setQuery("");
    setResults([]);
    setHasLoadedOnce(false);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      if (highlighted >= 0 && results[highlighted]) {
        event.preventDefault();
        handleSelect(results[highlighted]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (selectedName) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Paciente</label>
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-[var(--badge-bg)] px-3.5 py-2">
          <Avatar name={selectedName} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-text-primary">{selectedName}</p>
            {selectedPhone && <p className="truncate text-xs text-text-secondary">{selectedPhone}</p>}
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 text-xs font-bold text-[var(--primary)] hover:underline"
            >
              Trocar
            </button>
          )}
        </div>
      </div>
    );
  }

  const showEmptyRegistry = hasLoadedOnce && !loading && results.length === 0 && query.trim().length === 0;
  const showNoMatches = hasLoadedOnce && !loading && results.length === 0 && query.trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label htmlFor="patient-picker-field" className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
        Paciente
      </label>
      <div className="relative">
        <input
          id="patient-picker-field"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="patient-picker-listbox"
          autoComplete="off"
          placeholder="Buscar por nome, telefone, WhatsApp ou e-mail..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-xl border border-border bg-card-elevated px-3.5 text-xs font-medium text-text-primary placeholder:text-text-muted transition-all duration-200 ease-out focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:shadow-[0_0_15px_rgba(15,118,110,0.15)]"
        />

        {open && (
          <div
            id="patient-picker-listbox"
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-card-hover"
          >
          {loading && !hasLoadedOnce ? (
            <div className="px-4 py-3 text-xs text-text-muted">Carregando pacientes...</div>
          ) : showEmptyRegistry ? (
            <div className="px-4 py-3 text-xs text-text-muted">Nenhum paciente cadastrado.</div>
          ) : showNoMatches ? (
            <div className="px-4 py-3 text-xs text-text-muted">Nenhum paciente encontrado para &quot;{query}&quot;.</div>
          ) : (
            results.map((patient, index) => (
              <button
                key={patient.id}
                type="button"
                role="option"
                aria-selected={highlighted === index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(patient)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                  highlighted === index ? "bg-surface/70" : "hover:bg-surface/60"
                }`}
              >
                <Avatar src={patient.avatarUrl} name={patient.fullName} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{patient.fullName}</p>
                  <p className="truncate text-xs text-text-secondary">{patient.phone || "Sem telefone"}</p>
                </div>
              </button>
            ))
          )}
          </div>
        )}
      </div>
    </div>
  );
}
