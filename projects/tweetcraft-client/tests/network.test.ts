// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hookNetwork } from '../src/game/hooks/network';

class Socket extends EventTarget {
  constructor(public url: string) { super(); }
  send(_data: string) {}
}
afterEach(() => vi.unstubAllGlobals());
describe('socket observation', () => {
  it('observes only the current game socket and restores every hook', () => {
    vi.stubGlobal('WebSocket', Socket);
    const report = vi.fn(), hook = hookNetwork(report), url = `wss://${location.host}/ws/abcdefghijklmnop`;
    const other = new WebSocket('wss://elsewhere.test/ws/abcdefghijklmnop');
    other.dispatchEvent(new Event('open')); expect(hook.state(0).connected).toBe(false);
    const first = new WebSocket(url);
    first.dispatchEvent(new Event('open')); first.send('{"t":"hello","v":5}');
    first.dispatchEvent(new MessageEvent('message', { data: '{"t":"synced"}' }));
    expect(hook.state(0)).toMatchObject({ connected: true, compatible: true, synced: true });
    const second = new WebSocket(url); second.dispatchEvent(new Event('open'));
    first.send('{"t":"hello","v":6}'); first.dispatchEvent(new Event('close'));
    first.dispatchEvent(new MessageEvent('message', { data: '{"t":"old"}' }));
    expect(hook.state(0).connected).toBe(true);
    second.send('{"t":"hello","v":5}'); second.dispatchEvent(new Event('close'));
    expect(hook.state(0).connected).toBe(false);
    hook.dispose(); expect(window.WebSocket).toBe(Socket); expect(first.send).toBe(Socket.prototype.send); expect(report).not.toHaveBeenCalled();
  });
});
