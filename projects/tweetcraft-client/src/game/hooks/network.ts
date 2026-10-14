import { createTracker } from '../protocol/tracker';

export function hookNetwork(report: (error: unknown) => void) {
  const tracker = createTracker(), original = window.WebSocket;
  let current: WebSocket | null = null;
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
      const hooked = new Proxy(send, { apply(fn, receiver, data) {
        if (current === socket) tracker.outgoing(data[0]);
        return Reflect.apply(fn, receiver, data);
      } });
      socket.send = hooked;
      cleanups.push(() => { controller.abort(); if (socket.send === hooked) socket.send = send; });
      return socket;
    },
  });
  window.WebSocket = wrapper;
  return {
    state: tracker.state,
    dispose() {
      if (window.WebSocket === wrapper) window.WebSocket = original;
      cleanups.forEach(fn => fn()); tracker.close();
    },
  };
}
