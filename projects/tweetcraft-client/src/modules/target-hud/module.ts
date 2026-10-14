import type { ModuleDefinition } from '../../core/module';
import { numberSetting as number } from '../settings';

export const module: ModuleDefinition = {
    id: 'target-hud', name: 'Target HUD', description: 'Shared combat target and angular FOV guide.', category: 'Combat', requires: ['entities', 'camera'], settings: {
      range: number('Target range', 6, 1, 32, .5), fov: number('FOV (degrees)', 60, 5, 170, 5),
    }, defaultEnabled: true,
    create: () => ({ render({ game, settings, target }, ctx) {
      const camera = game.camera;
      if (!camera) return;
      const radius = Math.tan(Number(settings.fov) * Math.PI / 360) * Math.hypot(camera.matrix[1]!, camera.matrix[5]!, camera.matrix[9]!) * camera.height / 2;
      ctx.strokeStyle = '#6fe9cc66'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(camera.width / 2, camera.height / 2, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e0fff6'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(target ? `${target.entity.name}  ${target.distance.toFixed(1)}m` : 'NO TARGET', camera.width / 2, camera.height / 2 + 64);
    } }),
  };
