import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
    id: 'coordinates', name: 'Coordinates', description: 'Your live position from the game engine.', category: 'Client', requires: ['position'], defaultEnabled: true, settings: {},
    create: () => ({ render({ game }, ctx) {
      if (!game.position) return;
      const { x, y, z } = game.position;
      ctx.fillStyle = '#a8ffee'; ctx.font = '12px monospace';
      ctx.fillText(`XYZ  ${x.toFixed(1)}  ${y.toFixed(1)}  ${z.toFixed(1)}`, 20, 30);
    } }),
  };
