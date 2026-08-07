"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { AIDisclaimerNotice } from "./AIDisclaimerNotice";
import {
  updateAIProviderSettings,
  testAIConnection,
  updateAIFeatureToggles,
  updateAIUsageLimits,
} from "@/modules/ai/services/ai-settings-actions";
import { PROVIDER_LABELS, type AIProviderId } from "@/modules/ai/services/provider-types";
import type { AISettingsForAdmin } from "@/modules/ai/services/ai-settings-queries";

const PROVIDERS = Object.keys(PROVIDER_LABELS) as AIProviderId[];

const STATUS_BADGE: Record<AISettingsForAdmin["connectionStatus"], { label: string; tone: "success" | "danger" | "neutral" }> = {
  connected: { label: "🟢 Conectado", tone: "success" },
  error: { label: "🔴 Erro na conexão", tone: "danger" },
  not_configured: { label: "⚪ Não configurado", tone: "neutral" },
};

export function AISettingsCard({ initial }: { initial: AISettingsForAdmin }) {
  const router = useRouter();
  const toast = useToast();

  const [provider, setProvider] = useState<AIProviderId>(initial.provider);
  const [model, setModel] = useState(initial.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(initial.connectionStatus);

  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [evolutionAssistantEnabled, setEvolutionAssistantEnabled] = useState(initial.evolutionAssistantEnabled);
  const [showReviewNotice, setShowReviewNotice] = useState(initial.showReviewNotice);
  const [reportsEnabled, setReportsEnabled] = useState(initial.reportsEnabled);
  const [patientAssistantEnabled, setPatientAssistantEnabled] = useState(initial.patientAssistantEnabled);

  const [monthlyLimit, setMonthlyLimit] = useState(initial.monthlyRequestLimit?.toString() ?? "");
  const [dailyLimit, setDailyLimit] = useState(initial.dailyRequestLimit?.toString() ?? "");
  const [perUserLimit, setPerUserLimit] = useState(initial.monthlyRequestLimitPerUser?.toString() ?? "");
  const [limitAction, setLimitAction] = useState(initial.limitAction);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleTestConnection() {
    setTesting(true);
    const result = await testAIConnection({ provider, model, apiKey });
    setTesting(false);
    if (result.error) {
      setStatus("error");
      toast.error(result.error);
      return;
    }
    setStatus("connected");
    toast.success("Conexão validada com sucesso.");
  }

  async function handleSave() {
    setSaving(true);

    const providerResult = await updateAIProviderSettings({ provider, model, apiKey });
    if (providerResult.error) {
      setSaving(false);
      toast.error(providerResult.error);
      return;
    }

    const togglesResult = await updateAIFeatureToggles({
      ai_enabled: aiEnabled,
      evolution_assistant_enabled: evolutionAssistantEnabled,
      show_review_notice: showReviewNotice,
      reports_enabled: reportsEnabled,
      patient_assistant_enabled: patientAssistantEnabled,
    });
    if (togglesResult.error) {
      setSaving(false);
      toast.error(togglesResult.error);
      return;
    }

    const limitsResult = await updateAIUsageLimits({
      monthly_request_limit: monthlyLimit,
      daily_request_limit: dailyLimit,
      monthly_request_limit_per_user: perUserLimit,
      limit_action: limitAction,
    });
    setSaving(false);
    if (limitsResult.error) {
      toast.error(limitsResult.error);
      return;
    }

    setApiKey("");
    toast.success("Configurações de IA salvas.");
    router.refresh();
  }

  const badge = STATUS_BADGE[status];

  return (
    <div className="flex flex-col gap-5">
      <AIDisclaimerNotice />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Provedor de IA" value={provider} onChange={(e) => setProvider(e.target.value as AIProviderId)}>
          {PROVIDERS.map((id) => (
            <option key={id} value={id}>
              {PROVIDER_LABELS[id]}
            </option>
          ))}
        </Select>

        <Input
          label="Modelo (opcional)"
          placeholder="Deixe em branco para usar o padrão do provedor"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Chave de API</label>
        <div className="flex items-center gap-2">
          <Input
            type={showKey ? "text" : "password"}
            placeholder={initial.hasApiKey ? `•••• configurada (final ${initial.apiKeyLast4})` : "Cole a chave do provedor"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => setShowKey((prev) => !prev)}>
            {showKey ? "Ocultar" : "Mostrar"}
          </Button>
          <Button type="button" size="sm" variant="secondary" isLoading={testing} onClick={handleTestConnection}>
            Testar Conexão
          </Button>
        </div>
        <div>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Recursos de IA</p>
        <Switch label="Habilitar IA na clínica" checked={aiEnabled} onChange={setAiEnabled} />
        <Switch
          label="Assistente de Escrita das Evoluções"
          checked={evolutionAssistantEnabled}
          onChange={setEvolutionAssistantEnabled}
        />
        <Switch label="Exibir aviso de revisão obrigatória" checked={showReviewNotice} onChange={setShowReviewNotice} />
        <Switch label="Relatórios Inteligentes" checked={reportsEnabled} onChange={setReportsEnabled} />
        <Switch label="Assistente do Prontuário" checked={patientAssistantEnabled} onChange={setPatientAssistantEnabled} />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
        <Input
          label="Limite mensal por clínica (opcional)"
          type="number"
          min={1}
          placeholder="Sem limite"
          value={monthlyLimit}
          onChange={(e) => setMonthlyLimit(e.target.value)}
        />
        <Input
          label="Limite diário por clínica (opcional)"
          type="number"
          min={1}
          placeholder="Sem limite"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
        />
        <Input
          label="Limite mensal por usuário (opcional)"
          type="number"
          min={1}
          placeholder="Sem limite"
          value={perUserLimit}
          onChange={(e) => setPerUserLimit(e.target.value)}
        />
        <Select label="Ao atingir o limite" value={limitAction} onChange={(e) => setLimitAction(e.target.value as typeof limitAction)}>
          <option value="block">Bloquear IA</option>
          <option value="warn">Avisar apenas</option>
          <option value="allow">Continuar normalmente</option>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="button" isLoading={saving} onClick={handleSave}>
          Salvar Configurações de IA
        </Button>
      </div>
    </div>
  );
}
