import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Testes unitários de lógica pura (sem banco, sem servidor Next). Mesmo
// alias "@/*" do tsconfig.json, só o necessário pra importar módulos de
// src/ nos testes sem precisar subir a aplicação.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
