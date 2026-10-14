import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
    id: 'coordinates', name: 'Coordinates', description: 'Your live position from the game engine.', category: 'Client', requires: ['position'], defaultEnabled: true, settings: {},
    create: () => ({ render({ game, hud }, ctx) {
      if (!game.position) return;
      const rect = hud.reserve(370, 28);
      if (!rect) return;
      const { x, y, z } = game.position;
      ctx.fillStyle = '#0b121be6'; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.fillStyle = '#a8ffee'; ctx.font = '12px monospace';
      ctx.fillText(`XYZ  ${x.toFixed(1)}  ${y.toFixed(1)}  ${z.toFixed(1)}`, rect.x + 10, rect.y + 19, rect.width - 20);
    } }),
  };
