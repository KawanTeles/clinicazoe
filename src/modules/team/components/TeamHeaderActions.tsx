"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PatientForm } from "@/modules/patients/components/PatientForm";

interface Option {
  id: string;
  name: string;
}

export function TeamHeaderActions({
  insurances,
  professionals,
}: {
  insurances: Option[];
  professionals: Option[];
}) {
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button variant="secondary" onClick={() => setIsPatientModalOpen(true)}>
        + Adicionar Paciente
      </Button>
      <Link href="/team/new">
        <Button>Novo membro</Button>
      </Link>

      <Modal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        title="Adicionar Novo Paciente"
        subtitle="Mesmo cadastro usado em Pacientes → Novo, com convênio e histórico — aqui o paciente já sai com e-mail e senha de acesso definidos."
        size="xl"
      >
        <PatientForm
          mode="create"
          insurances={insurances}
          professionals={professionals}
          withCredentials
          onCancel={() => setIsPatientModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
