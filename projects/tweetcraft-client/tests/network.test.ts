// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hookNetwork } from '../src/game/hooks/network';

class Socket extends EventTarget {
  constructor(public url: string) { super(); }
  readyState = 1;
  sent: (string | ArrayBuffer)[] = [];
  send(data: string | ArrayBuffer) { if (this.readyState !== 1) throw new Error('Socket closed'); this.sent.push(data); }
}
afterEach(() => vi.unstubAllGlobals());
describe('socket observation', () => {
  it('supplements only live recognized movement, then stops on resets, disconnects, and stale native traffic', () => {
    vi.stubGlobal('WebSocket', Socket);
    let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const report = vi.fn(), hook = hookNetwork(report), socket = new WebSocket(`wss://${location.host}/ws/abcdefghijklmnop`);
    const native = new ArrayBuffer(18), view = new DataView(native);
    view.setUint8(0, 1); view.setFloat32(5, 64, true);
    const camera = { position: { x: 0, y: 65.62, z: 0 }, matrix: [], yaw: 0, pitch: 0, firstPerson: true, updatedAt: 0, width: 800, height: 600 };
    const position = { x: 1, y: 64, z: 0 };
    expect(hook.sync(position, camera, 50)).toBe(false);
    socket.dispatchEvent(new Event('open')); socket.send('{"t":"hello","v":5}');
    socket.dispatchEvent(new MessageEvent('message', { data: '{"t":"welcome","sv":{}}' })); socket.send(native);
    expect(hook.sync(position, camera, 50)).toBe(false);
    socket.dispatchEvent(new MessageEvent('message', { data: '{"t":"synced"}' }));
    now = 50; expect(hook.sync(position, camera, now)).toBe(true);
    expect(hook.state(now).movement).toMatchObject({ rate: 2, extraPackets: 1 });
    expect(hook.sync({ ...position, x: 2 }, camera, 99)).toBe(false);
    expect(hook.sync({ ...position, x: 2 }, camera, 1001)).toBe(false);
    socket.dispatchEvent(new MessageEvent('message', { data: '{"t":"place","st":{"x":0,"y":64,"z":0}}' }));
    expect(hook.state(now).movement).toMatchObject({ resets: 1, lastResetDistance: 1 });
    expect(hook.state(now).synced).toBe(false);
    expect(hook.sync(position, camera, 100)).toBe(false);
    now = 100; socket.send(native); socket.dispatchEvent(new MessageEvent('message', { data: '{"t":"synced"}' }));
    const sender = vi.spyOn(Socket.prototype, 'send').mockImplementationOnce(() => { throw new Error('Send failed'); });
    // The hook retains the sender captured for this socket, so a later replacement cannot break it.
    expect(hook.sync(position, camera, 150)).toBe(true); sender.mockRestore();
    (socket as unknown as Socket).readyState = 3;
    expect(hook.sync(position, camera, 200)).toBe(false);
    socket.dispatchEvent(new Event('close')); expect(hook.state(200).canSync).toBe(false);
    hook.dispose(); vi.restoreAllMocks();
  });
  it('reports send failures without counting an unsent supplement', () => {
    class FailingSocket extends Socket {
      fail = false;
      override send(data: string | ArrayBuffer) { if (this.fail) throw new Error('Send failed'); super.send(data); }
    }
    vi.stubGlobal('WebSocket', FailingSocket); vi.spyOn(performance, 'now').mockReturnValue(0);
    const report = vi.fn(), hook = hookNetwork(report), socket = new WebSocket(`wss://${location.host}/ws/abcdefghijklmnop`);
    socket.dispatchEvent(new Event('open')); socket.send('{"t":"hello","v":5}');
    socket.dispatchEvent(new MessageEvent('message', { data: '{"t":"synced"}' }));
    const packet = new ArrayBuffer(18); new DataView(packet).setUint8(0, 1); socket.send(packet);
    (socket as unknown as FailingSocket).fail = true;
    const camera = { position: { x: 0, y: 1.62, z: 0 }, matrix: [], yaw: 0, pitch: 0, firstPerson: true, updatedAt: 0, width: 800, height: 600 };
    expect(hook.sync({ x: 1, y: 0, z: 0 }, camera, 50)).toBe(false);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: 'Send failed' }));
    expect(hook.state(50).movement.extraPackets).toBe(0); hook.dispose(); vi.restoreAllMocks();
  });
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
