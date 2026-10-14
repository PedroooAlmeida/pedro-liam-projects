import type { ModuleDefinition } from '../../core/module';
import { numberSetting as number, booleanSetting as boolean } from '../settings';

export const module: ModuleDefinition = {
    id: 'target-hud', name: 'Target HUD', description: 'Shared combat target and angular FOV guide.', category: 'Combat', requires: ['entities', 'camera'], settings: {
      range: number('Target range', 6, 1, 32, .5), fov: number('FOV (degrees)', 60, 5, 170, 5),
      players: boolean('Target players', true), hostile: boolean('Target hostile mobs', true), animals: boolean('Target animals', true),
    }, defaultEnabled: true,
    create: () => ({ render({ game, settings, target, hud }, ctx) {
      const camera = game.camera;
      if (!camera) return;
      const radius = Math.tan(Number(settings.fov) * Math.PI / 360) * Math.hypot(camera.matrix[1]!, camera.matrix[5]!, camera.matrix[9]!) * camera.height / 2;
      ctx.strokeStyle = '#6fe9cc66'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(camera.width / 2, camera.height / 2, radius, 0, Math.PI * 2); ctx.stroke();
      const rect = hud.reserve(370, 30);
      if (!rect) return;
      ctx.fillStyle = '#0b121be6'; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.fillStyle = '#e0fff6'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(target ? `Target  ${target.entity.name}  ${target.distance.toFixed(1)}m` : 'Target  None in range', rect.x + 10, rect.y + 20, rect.width - 20);
    } }),
  };
