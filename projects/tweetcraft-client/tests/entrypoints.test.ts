// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANNEL } from '../src/bridge/messages';
import type { GameSnapshot } from '../src/game/types';

const driver = vi.hoisted(() => ({ snapshot: vi.fn(), aim: vi.fn(() => true), attack: vi.fn(() => true), visible: vi.fn(() => true), dispose: vi.fn() }));
vi.mock('../src/game/adapter', () => ({ createAdapter: () => driver }));
const snapshot: GameSnapshot = { connected: true, synced: true, active: false, selfId: 1, position: { x: 1, y: 64, z: 1 }, entities: [], camera: null,
  capabilities: new Set(['position']), issues: [], attackRequests: 0, hitEvents: 0, deniedHits: 0 };
afterEach(() => { window.dispatchEvent(new Event('pagehide')); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); document.body.innerHTML = ''; });
describe('entrypoint integration', () => {
  it('runs a single shared frame loop, handles configuration, and disposes old runtimes', async () => {
    let next: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => { next = fn; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    driver.snapshot.mockReturnValue(snapshot);
    const ctx = new Proxy({}, { get: () => vi.fn(), set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const messages = vi.spyOn(window, 'postMessage');
    await import('../src/entrypoints/main');
    const run = (now: number) => (next as unknown as FrameRequestCallback)(now);
    run(100); run(110);
    expect(document.querySelector('#tweetcraft-client-overlay')).not.toBeNull();
    expect(messages).toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
      data: { channel: CHANNEL, direction: 'command', type: 'configure', profile: { version: 1, modules: {} } } }));
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin, data: { channel: CHANNEL, direction: 'command', type: 'menu', open: true } }));
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'https://other.test', data: {} }));
    run(500);
    vi.resetModules(); await import('../src/entrypoints/main'); expect(driver.dispose).toHaveBeenCalled();
    run(600); window.dispatchEvent(new Event('pagehide')); expect(document.querySelector('#tweetcraft-client-overlay')).toBeNull();
    run(700);
  });
  it('loads saved settings, handshakes with the runtime, and persists changes', async () => {
    vi.useFakeTimers();
    const get = vi.fn().mockResolvedValue({ profile: { version: 1, modules: {} } }), set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get, set } } });
    const post = vi.spyOn(window, 'postMessage');
    await import('../src/entrypoints/content'); await vi.advanceTimersByTimeAsync(0);
    const shadow = document.querySelector('#tweetcraft-client-ui')!.shadowRoot!;
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin, data: { channel: CHANNEL, direction: 'status', status: { modules: [], capabilities: [], connected: false, players: 0, issues: [] } } }));
    expect(post).toHaveBeenCalled();
    shadow.querySelector<HTMLButtonElement>('.launcher')!.click();
    shadow.querySelector<HTMLInputElement>('.toggle')!.click();
    expect(set).toHaveBeenCalled(); // Persistence is dispatched before an immediate refresh.
    await vi.advanceTimersByTimeAsync(250); expect(set).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000); expect(shadow.textContent).not.toContain('did not respond');
    window.dispatchEvent(new Event('pagehide')); expect(document.querySelector('#tweetcraft-client-ui')).toBeNull();
    vi.useRealTimers();
  });
  it('reports storage and startup timeout errors without losing the menu', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn().mockRejectedValue(new Error('load failed')), set: vi.fn().mockRejectedValue(new Error('save failed')) } } });
    await import('../src/entrypoints/content'); await vi.advanceTimersByTimeAsync(0);
    const shadow = document.querySelector('#tweetcraft-client-ui')!.shadowRoot!;
    expect(shadow.textContent).toContain('could not load');
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'https://other.test', data: {} }));
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin, data: {} }));
    shadow.querySelector<HTMLInputElement>('.toggle')!.click(); await vi.advanceTimersByTimeAsync(250);
    expect(shadow.textContent).toContain('could not save');
    await vi.advanceTimersByTimeAsync(5000); expect(shadow.textContent).toContain('did not respond');
    window.dispatchEvent(new Event('pagehide')); vi.useRealTimers();
  });
});
