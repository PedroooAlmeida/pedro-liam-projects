import type { ModuleDefinition } from '../../core/module';
import { distance, project } from '../../services/targeting';
import { numberSetting as number, booleanSetting as boolean } from '../settings';

export const module: ModuleDefinition = {
    id: 'player-esp', name: 'Player ESP', description: 'Boxes and distance labels for tracked players.', category: 'Render', requires: ['position', 'entities', 'camera'], settings: {
      range: number('Distance', 80, 4, 128), tracers: boolean('Tracers', false),
    },
    create: () => ({ render({ game, settings }, ctx) {
      const camera = game.camera;
      if (!camera || !game.position) return;
      for (const entity of game.entities) {
        const d = distance(game.position, entity);
        if (d > Number(settings.range)) continue;
        const foot = project(entity, camera), head = project({ ...entity, y: entity.y + (entity.crouching ? 1.5 : 1.8) }, camera);
        if (!foot || !head) continue;
        const height = Math.abs(foot.y - head.y), width = height * .42;
        ctx.strokeStyle = '#6fe9cc'; ctx.lineWidth = 1.5;
        ctx.strokeRect(head.x - width / 2, head.y, width, height);
        ctx.fillStyle = '#e0fff6'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`${entity.name} · ${d.toFixed(1)}m`, head.x, head.y - 8);
        if (settings.tracers) { ctx.beginPath(); ctx.moveTo(camera.width / 2, camera.height); ctx.lineTo(foot.x, foot.y); ctx.stroke(); }
      }
    } }),
  };
