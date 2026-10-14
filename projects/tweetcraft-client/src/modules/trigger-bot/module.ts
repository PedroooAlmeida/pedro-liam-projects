import type { ModuleDefinition } from '../../core/module';
import { numberSetting as number } from '../settings';

export const module: ModuleDefinition = {
    id: 'trigger-bot', name: 'Trigger Bot', description: 'Clicks through the game controls when a target is aligned and in range.', category: 'Combat', requires: ['entities', 'camera', 'attack', 'world'], settings: {
      range: number('Attack range', 3, 1, 4, .1), interval: number('Click interval (ms)', 600, 100, 1500, 50),
      tolerance: number('Alignment (degrees)', 2, .5, 5, .5),
    },
    create: () => ({ update({ game, target, settings, actions }) {
      if (!game.active || !target || target.distance > Number(settings.range) || target.error > Number(settings.tolerance) * Math.PI / 180) return;
      actions.attack({ owner: 'trigger-bot', priority: 10, interval: Number(settings.interval) });
    } }),
  };
