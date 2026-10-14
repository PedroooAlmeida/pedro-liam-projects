import type { ModuleDefinition } from '../../core/module';
import { angleDelta, aimStep } from '../../services/targeting';
import { numberSetting as number } from '../settings';

export const module: ModuleDefinition = {
    id: 'aim-assist', name: 'Aim Assist', description: 'Turns toward the shared target while first-person controls are active.', category: 'Combat', requires: ['entities', 'camera', 'aim', 'world'], settings: {
      speed: number('Turn speed (degrees/s)', 90, 10, 360, 10),
    },
    create: () => ({ update({ game, target, dt, settings, actions }) {
      if (!game.active || !target || !game.camera) return;
      const step = aimStep(angleDelta(target.yaw, game.camera.yaw), angleDelta(target.pitch, game.camera.pitch), Number(settings.speed), dt);
      actions.aim({ owner: 'aim-assist', priority: 10, yaw: step.yaw, pitch: step.pitch });
    } }),
  };
