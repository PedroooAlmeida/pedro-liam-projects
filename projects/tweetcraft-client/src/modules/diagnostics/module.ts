import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
    id: 'diagnostics', name: 'Diagnostics', description: 'Connection, hook health, and observed combat traffic.', category: 'Client', requires: [], defaultEnabled: true, settings: {},
    create: () => ({ render({ game, hud }, ctx) {
      const lines = [
        `TWEETCRAFT CLIENT  ·  ${game.connected ? game.synced ? 'ONLINE' : 'SYNCING' : 'CONNECTING'}`,
        `Engine ${game.position ? 'OK' : 'waiting'} / Camera ${game.camera ? 'OK' : 'waiting'}`,
        `Players ${game.entities.filter(e => e.type === 'player').length} / Mobs ${game.entities.filter(e => e.type !== 'player').length}`,
        `Attack requests ${game.attackRequests}  /  Hurt events ${game.hitEvents}  /  Denied ${game.deniedHits}`,
        ...game.issues,
      ];
      const rect = hud.reserve(370, lines.length * 19 + 16);
      if (!rect) return;
      ctx.font = '11px monospace';
      ctx.fillStyle = '#0b121be6'; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.fillStyle = '#bfccd8'; lines.forEach((line, i) => ctx.fillText(line, rect.x + 10, rect.y + 21 + i * 19, rect.width - 20));
    } }),
  };
