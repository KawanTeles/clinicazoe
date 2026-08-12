// Config do PM2 para rodar o ClinicaZoe em produção (self-hosted, sem Vercel).
//
// instances = 1 é obrigatório, não uma opção de tuning: rate-limit
// (src/lib/rate-limit.ts) e outros caches em memória do processo assumem um
// único processo Node. Rodar em modo cluster/múltiplas instâncias faria cada
// instância ter seu próprio estado de rate-limit, na prática multiplicando o
// limite real por N sem nenhum aviso.
//
// Uso:
//   npm run build
//   pm2 start ecosystem.config.js
//   pm2 save
module.exports = {
  apps: [
    {
      name: "clinicazoe",
      script: "npm",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
