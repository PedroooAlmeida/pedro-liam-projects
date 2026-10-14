import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
  id: 'movement-sync', name: 'Movement Sync', description: 'Fill gaps in movement updates at 50ms intervals. Experimental; server resets may continue.',
  category: 'Movement', requires: ['position', 'camera', 'movement-sync'], settings: {},
  create: () => ({ update({ game, actions }) {
    if (game.active) actions.movementSync({ owner: 'movement-sync', priority: 10 });
  } }),
};
