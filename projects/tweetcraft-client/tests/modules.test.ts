import { describe, expect, it, vi } from 'vitest';
import { definitions } from '../src/modules/registry';
import type { ModuleContext } from '../src/core/module';
import { settingsValues } from '../src/core/settings';
import { createActions } from '../src/services/actions';
import { selectTarget } from '../src/services/targeting';
import type { Camera, GameSnapshot } from '../src/game/types';
import { createHudLayout } from '../src/services/hud-layout';

const camera: Camera = { position: { x: 0, y: 1.62, z: 0 }, matrix: [1,0,0,0,0,1,0,0,0,0,-1,-1,0,0,-.1,0], yaw: 0, pitch: 0, width: 800, height: 600, updatedAt: 100, firstPerson: true };
const game: GameSnapshot = { connected: true, synced: true, active: true, selfId: 1, position: { x: 0, y: 0, z: 0 }, camera,
  entities: [{ id: 2, x: 0, y: 0, z: -2.5, name: 'Friend', crouching: false, updatedAt: 100 }], capabilities: new Set(), issues: [], attackRequests: 1, hitEvents: 0, deniedHits: 0 };
const drawContext = () => ({ fillText: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn() }) as unknown as CanvasRenderingContext2D;
const context = (): ModuleContext => ({ game, now: 100, dt: .016, settings: {}, signal: new AbortController().signal, hud: createHudLayout(800, 1000, []),
  target: selectTarget(game.entities, camera, { range: 6, fov: 90, selfId: 1, now: 100, visible: () => true }),
  actions: createActions({ aim: () => true, attack: () => true }), visible: () => true });

describe('built-in modules', () => {
  it('renders diagnostics, coordinates, and valid player bounds', () => {
    for (const definition of definitions.filter(d => d.category !== 'Combat')) {
      const module = definition.create(), canvas = drawContext(), base = context();
      const settings = settingsValues(definition.settings, { tracers: true });
      module.render?.({ ...base, settings }, canvas);
      expect(canvas.fillText).toHaveBeenCalled();
      module.render?.({ ...base, game: { ...game, position: null, camera: null, connected: false } }, canvas);
      module.render?.({ ...base, settings, game: { ...game, entities: [{ ...game.entities[0]!, z: 3 }, { ...game.entities[0]!, z: -500 }, { ...game.entities[0]!, crouching: true }] } }, canvas);
    }
  });
  it('draws target guide independently of whether a target is available', () => {
    const definition = definitions.find(d => d.id === 'target-hud')!, module = definition.create(), canvas = drawContext(), base = context();
    const settings = settingsValues(definition.settings, {});
    module.render?.({ ...base, settings }, canvas); expect(canvas.arc).toHaveBeenCalled();
    module.render?.({ ...base, settings, target: null }, canvas);
    expect(canvas.fillText).toHaveBeenLastCalledWith('Target  None in range', expect.any(Number), expect.any(Number), 350);
    module.render?.({ ...base, settings, game: { ...game, camera: null } }, canvas);
  });
  it('requests aim only when a valid target and camera exist', () => {
    const definition = definitions.find(d => d.id === 'aim-assist')!, module = definition.create(), base = context();
    const aim = vi.spyOn(base.actions, 'aim'), settings = settingsValues(definition.settings, {});
    module.update?.({ ...base, settings }); expect(aim).toHaveBeenCalledTimes(1);
    module.update?.({ ...base, settings, target: null });
    module.update?.({ ...base, settings, game: { ...game, camera: null } });
    module.update?.({ ...base, settings, game: { ...game, active: false } }); expect(aim).toHaveBeenCalledTimes(1);
  });
  it('clicks only for an aligned target in range during active gameplay', () => {
    const definition = definitions.find(d => d.id === 'trigger-bot')!, module = definition.create(), base = context();
    const attack = vi.spyOn(base.actions, 'attack'), settings = settingsValues(definition.settings, {});
    module.update?.({ ...base, settings, target: { ...base.target!, error: 0 } }); expect(attack).toHaveBeenCalledTimes(1);
    module.update?.({ ...base, settings, target: null });
    module.update?.({ ...base, settings, game: { ...game, active: false } });
    module.update?.({ ...base, settings, target: { ...base.target!, error: 1 } });
    module.update?.({ ...base, settings, target: { ...base.target!, distance: 10 } });
    expect(attack).toHaveBeenCalledTimes(1);
  });
});
