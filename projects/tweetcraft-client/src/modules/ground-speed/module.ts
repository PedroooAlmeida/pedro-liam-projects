import type { ModuleDefinition } from '../../core/module';

export const module: ModuleDefinition = {
  id: 'ground-speed', name: 'Ground Speed', description: 'Boost movement on solid ground and suppress jumping. Start low; server limits still apply.',
  category: 'Movement', requires: ['position', 'flight'],
  settings: { multiplier: { kind: 'number', label: 'Speed multiplier', default: 1.5, min: 1, max: 3, step: .1 } },
  create: () => ({ update({ game, settings, actions }) {
    if (game.active) actions.groundSpeed({ owner: 'ground-speed', priority: 10, multiplier: Number(settings.multiplier) });
  } }),
};
