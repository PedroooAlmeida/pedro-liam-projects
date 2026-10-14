import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
  id: 'flight', name: 'Flight', description: 'Fly using WASD, Space to rise, and Left Shift to descend. Server acceptance requires live testing.',
  category: 'Movement', requires: ['position', 'flight'], settings: {},
  create: () => ({ update({ game, actions }) {
    if (game.active) actions.flight({ owner: 'flight', priority: 10 });
  } }),
};
