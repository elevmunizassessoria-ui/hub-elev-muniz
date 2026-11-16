// Modo desenvolvimento: servidor (porta 3180, reinicia ao salvar) e tela (Vite, porta 5180) juntos.
import { spawn } from 'node:child_process';

const filhos = [
  spawn(process.execPath, ['--watch-path=server', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, HUB_HOST: process.env.HUB_HOST ?? '127.0.0.1' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'web/vite.config.ts'], { stdio: 'inherit' }),
];

const parar = () => {
  for (const f of filhos) f.kill();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
for (const f of filhos) f.on('exit', (code) => code && parar());
