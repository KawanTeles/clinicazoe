"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/modules/auth/services/auth-client";

export function PatientSignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={loading}
      className="text-xs font-semibold text-danger hover:bg-danger/15 hover:text-danger"
    >
      {loading ? "Saindo..." : "Sair da conta"}
    </Button>
  );
}
