import { createTracker } from '../protocol/tracker';
import type { Camera, Vec3 } from '../types';

export function hookNetwork(report: (error: unknown) => void) {
  const tracker = createTracker(), original = window.WebSocket;
  let current: WebSocket | null = null;
  const senders = new WeakMap<WebSocket, WebSocket['send']>();
  const cleanups: (() => void)[] = [];
  const wrapper = new Proxy(original, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget) as WebSocket;
      const url = new URL(String(args[0]), location.href);
      if (url.host !== location.host || !/^\/ws\/[a-z0-9]{16}$/.test(url.pathname)) return socket;
      current = socket;
      const controller = new AbortController(), options = { signal: controller.signal };
      socket.addEventListener('open', () => { if (current === socket) tracker.open(); }, options);
      socket.addEventListener('message', event => {
        if (current !== socket) return;
        try { tracker.incoming(event.data, performance.now()); } catch (error) { report(error); }
      }, options);
      socket.addEventListener('close', () => { if (current === socket) tracker.close(); }, options);
      const send = socket.send;
      senders.set(socket, send);
      const hooked = new Proxy(send, { apply(fn, receiver, data) {
        const result = Reflect.apply(fn, receiver, data);
        if (current === socket) tracker.outgoing(data[0]);
        return result;
      } });
      socket.send = hooked;
      cleanups.push(() => { controller.abort(); if (socket.send === hooked) socket.send = send; });
      return socket;
    },
  });
  window.WebSocket = wrapper;
  return {
    state: tracker.state,
    sync(position: Vec3, camera: Camera, now: number) {
      const state = tracker.state(now), socket = current;
      if (!socket || socket.readyState !== 1 || !state.connected || !state.synced || !state.compatible) return false;
      const packet = tracker.movementPacket(position, camera, now);
      if (!packet) return false;
      try {
        // Use the original send so supplemental packets do not renew the native baseline timer.
        senders.get(socket)!.call(socket, packet);
        tracker.outgoing(packet, now, true);
        return true;
      } catch (error) { report(error); return false; }
    },
    dispose() {
      if (window.WebSocket === wrapper) window.WebSocket = original;
      cleanups.forEach(fn => fn()); tracker.close();
    },
  };
}
