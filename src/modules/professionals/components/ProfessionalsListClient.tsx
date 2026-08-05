"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { TeamMemberForm } from "@/modules/team/components/TeamMemberForm";

interface ProfessionalItem {
  id: string;
  full_name: string;
  avatarUrl: string | null;
  specialtyName: string | null;
  licenseNumber: string | null;
}

interface Option {
  id: string;
  name: string;
}

export function ProfessionalsListClient({
  professionals,
  specialties,
  insurances,
  canAdd,
}: {
  professionals: ProfessionalItem[];
  specialties: Option[];
  insurances: Option[];
  canAdd: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary font-heading">
            Profissionais
          </h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            Consulta de corpo clínico, especialidades e tabela de horários.
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => setIsModalOpen(true)} className="h-9 px-4 text-xs font-bold shadow-button">
            + Adicionar Profissional
          </Button>
        )}
      </div>

      {professionals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-xs font-medium text-text-secondary">
          Nenhum profissional ativo cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((professional) => (
            <Link key={professional.id} href={`/professionals/${professional.id}`}>
              <Card className="h-full transition-all hover:border-primary/60 hover:shadow-card-hover">
                <CardContent className="flex flex-col justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={professional.avatarUrl} name={professional.full_name} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text-primary">
                        {professional.full_name}
                      </p>
                      {professional.specialtyName && (
                        <p className="truncate text-xs font-semibold text-primary dark:text-[var(--link)] mt-0.5">
                          {professional.specialtyName}
                        </p>
                      )}
                    </div>
                  </div>
                  {professional.licenseNumber && (
                    <Badge tone="neutral" className="w-fit text-[10px]">
                      {professional.licenseNumber}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Modal XL: Adicionar Profissional */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Adicionar Novo Profissional"
        subtitle="Preencha os dados do corpo clínico para liberar a agenda e atendimentos."
        size="xl"
      >
        <TeamMemberForm
          mode="create"
          specialties={specialties}
          insurances={insurances}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
