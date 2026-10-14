// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdapter } from '../src/game/adapter';
import type { Camera } from '../src/game/types';

const hooks = vi.hoisted(() => ({
  engine: { position: vi.fn(), ready: vi.fn(), canFly: vi.fn(() => false), flight: vi.fn(() => false), visible: vi.fn(), dispose: vi.fn() },
  renderer: { camera: vi.fn(), dispose: vi.fn() }, network: { state: vi.fn(), dispose: vi.fn() },
}));
vi.mock('../src/game/hooks/engine', () => ({ hookEngine: () => hooks.engine }));
vi.mock('../src/game/hooks/renderer', () => ({ hookRenderer: () => hooks.renderer }));
vi.mock('../src/game/hooks/network', () => ({ hookNetwork: () => hooks.network }));
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });
describe('adapter capability gates', () => {
  const setup = () => {
    document.body.innerHTML = '<canvas id="gl"></canvas><input id="chatbox" hidden><canvas id="inv" class="off"></canvas>';
    const canvas = document.querySelector('#gl')!;
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    const lock = vi.spyOn(document, 'pointerLockElement', 'get').mockReturnValue(canvas);
    hooks.engine.position.mockReturnValue({ x: 0, y: 64, z: 0 }); hooks.engine.ready.mockReturnValue(true);
    const camera: Camera = { position: { x: 0, y: 65.62, z: 0 }, matrix: [], yaw: 0, pitch: 0, firstPerson: true, updatedAt: 100, width: 800, height: 600 };
    hooks.renderer.camera.mockReturnValue(camera);
    hooks.network.state.mockReturnValue({ compatible: true, connected: true, synced: true, selfId: 1, players: [], mobs: [], attackRequests: 0, hitEvents: 0, deniedHits: 0, issue: '' });
    return { canvas, lock, camera };
  };
  it('enables actions only with fresh first-person camera and active controls', () => {
    const { camera, lock } = setup(); let menu = false;
    const adapter = createAdapter(() => menu);
    expect(adapter.snapshot(100).capabilities).toEqual(new Set(['position', 'world', 'entities', 'camera', 'aim', 'attack']));
    menu = true; expect(adapter.snapshot(100).active).toBe(false); menu = false;
    hooks.renderer.camera.mockReturnValue({ ...camera, firstPerson: false }); expect(adapter.snapshot(100).active).toBe(false);
    hooks.renderer.camera.mockReturnValue(camera); expect(adapter.snapshot(500).camera).toBeNull();
    lock.mockReturnValue(null); expect(adapter.snapshot(100).active).toBe(false);
    adapter.dispose(); expect(hooks.engine.dispose).toHaveBeenCalled();
  });
  it('suspends actions while typing/inventory is open and uses native handlers when active', () => {
    const { canvas } = setup(), adapter = createAdapter(() => false);
    const move = vi.fn(), down = vi.fn(), up = vi.fn();
    window.addEventListener('mousemove', move); canvas.addEventListener('mousedown', down); window.addEventListener('mouseup', up);
    expect(adapter.aim(.1, -.1)).toBe(true); expect(move.mock.calls[0]![0].movementX).toBeLessThan(0);
    expect(adapter.attack()).toBe(true); expect(down).toHaveBeenCalledTimes(1); expect(up).toHaveBeenCalledTimes(1);
    expect(adapter.aim(NaN, 0)).toBe(false);
    document.querySelector<HTMLInputElement>('#chatbox')!.hidden = false;
    expect(adapter.attack()).toBe(false); expect(adapter.aim(.1, .1)).toBe(false);
    document.querySelector<HTMLInputElement>('#chatbox')!.hidden = true; document.querySelector('#inv')!.className = '';
    expect(adapter.snapshot(100).active).toBe(false);
    hooks.engine.ready.mockReturnValue(false); hooks.engine.position.mockReturnValue(null); hooks.renderer.camera.mockReturnValue(null);
    hooks.network.state.mockReturnValue({ compatible: false, connected: false, synced: false, selfId: null, players: [], mobs: [], attackRequests: 0, hitEvents: 0, deniedHits: 0, issue: 'Offline' });
    expect(adapter.snapshot(100).capabilities.size).toBe(0); expect(adapter.snapshot(100).issues).toContain('Offline');
    window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); adapter.dispose();
  });
});
