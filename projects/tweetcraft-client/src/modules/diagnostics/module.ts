import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
    id: 'diagnostics', name: 'Diagnostics', description: 'Connection, hook health, and observed combat traffic.', category: 'Client', requires: [], defaultEnabled: true, settings: {},
    create: () => ({ render({ game }, ctx) {
      const lines = [
        `TWEETCRAFT CLIENT  ·  ${game.connected ? game.synced ? 'ONLINE' : 'SYNCING' : 'CONNECTING'}`,
        `Engine ${game.position ? 'OK' : 'waiting'}  /  Camera ${game.camera ? 'OK' : 'waiting'}  /  Players ${game.entities.length}`,
        `Attack requests ${game.attackRequests}  /  Hurt events ${game.hitEvents}  /  Denied ${game.deniedHits}`,
        ...game.issues,
      ];
      ctx.font = '11px monospace';
      ctx.fillStyle = '#0b121be6'; ctx.fillRect(12, 43, 540, lines.length * 19 + 16);
      ctx.fillStyle = '#bfccd8'; lines.forEach((line, i) => ctx.fillText(line, 22, 64 + i * 19));
    } }),
  };
