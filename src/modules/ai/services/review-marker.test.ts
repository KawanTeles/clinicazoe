import { describe, expect, it } from "vitest";
import { hasPendingReviewMarkers, splitReviewMarkers } from "./review-marker";
import { flattenTopics, normalizeTopics } from "@/modules/evolutions/services/topic-content";

describe("hasPendingReviewMarkers", () => {
  it("detecta marcador pendente", () => {
    expect(hasPendingReviewMarkers("Paciente colaborativo. [[REVISAR: trecho inaudível]] Fim.")).toBe(true);
  });

  it("não acusa falso positivo em texto limpo", () => {
    expect(hasPendingReviewMarkers("Paciente colaborativo durante toda a sessão.")).toBe(false);
  });

  it("detecta marcador mesmo sem conteúdo dentro dos colchetes", () => {
    expect(hasPendingReviewMarkers("[[REVISAR:]]")).toBe(true);
  });
});

describe("splitReviewMarkers", () => {
  it("separa texto normal do trecho marcado, sem os delimitadores", () => {
    const segments = splitReviewMarkers("Antes. [[REVISAR: trecho duvidoso]] Depois.");
    expect(segments).toEqual([
      { type: "text", content: "Antes. " },
      { type: "marker", content: "trecho duvidoso" },
      { type: "text", content: " Depois." },
    ]);
  });
});

describe("regressão F3 — trava de revisão sobrevive à composição usada no servidor", () => {
  // Reproduz exatamente o que signEvolutionFromDraft/createEvolution calculam
  // antes de checar hasPendingReviewMarkers: normalizeTopics -> flattenTopics.
  // Garante que, se a IA deixar um [[REVISAR:]] em qualquer tópico, o texto
  // final que vai para o banco ainda carrega o marcador e a trava detecta.
  it("marcador num tópico sobrevive à normalização e ao achatamento", () => {
    const topics = [
      { label: "Evolução", content: "Sessão tranquila. [[REVISAR: nome incerto]] Sem intercorrências.", order: 0 },
    ];
    const clinicalEvolution = flattenTopics(normalizeTopics(topics));
    expect(hasPendingReviewMarkers(clinicalEvolution)).toBe(true);
  });

  it("texto só com espaços é descartado antes mesmo de chegar à trava de revisão", () => {
    const topics = [{ label: "Evolução", content: "   \n\t  ", order: 0 }];
    const clinicalEvolution = flattenTopics(normalizeTopics(topics));
    expect(clinicalEvolution).toBe("");
  });

  it("múltiplos tópicos sem marcador passam limpos", () => {
    const topics = [
      { label: "Evolução", content: "Boa evolução motora.", order: 0 },
      { label: "Observações", content: "Família presente.", order: 1 },
    ];
    const clinicalEvolution = flattenTopics(normalizeTopics(topics));
    expect(hasPendingReviewMarkers(clinicalEvolution)).toBe(false);
  });
});
