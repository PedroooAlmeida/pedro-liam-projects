import { createAdapter } from '../game/adapter';
import { createRuntime } from '../core/runtime';
import { definitions } from '../modules/registry';
import { createActions } from '../services/actions';
import { createOverlay } from '../services/overlay';
import { selectTarget } from '../services/targeting';
import { decodeCommand, sendStatus } from '../bridge/messages';

const guard = Symbol.for('tweetcraft-client.runtime');
const host = window as unknown as Record<symbol, { dispose(): void } | undefined>;
host[guard]?.dispose();
let menuOpen = false, disposed = false, previous = 0, lastStatus = -Infinity;
const adapter = createAdapter(() => menuOpen), runtime = createRuntime(definitions), actions = createActions(adapter);
let overlay: ReturnType<typeof createOverlay> | null = null;
const controller = new AbortController();
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const command = decodeCommand(event.data);
  if (!command) return;
  if (command.type === 'configure') runtime.apply(command.profile);
  else if (command.type === 'menu') menuOpen = command.open;
  lastStatus = -Infinity;
}, { signal: controller.signal });
let frame = 0;
function tick(now: number) {
  if (disposed) return;
  frame = requestAnimationFrame(tick);
  if (!document.documentElement) return;
  overlay ??= createOverlay();
  const game = adapter.snapshot(now), profile = runtime.profile();
  const targetSettings = profile.modules['target-hud']!.values;
  const target = game.camera && game.capabilities.has('entities') ? selectTarget(game.entities, game.camera, {
    range: Number(targetSettings.range), fov: Number(targetSettings.fov), selfId: game.selfId, now, visible: adapter.visible,
  }) : null;
  const base = { game, now, dt: previous ? Math.min(.1, (now - previous) / 1000) : 0, target, actions, visible: adapter.visible };
  previous = now;
  actions.begin(); runtime.tick(base);
  runtime.render(base, overlay.begin());
  actions.flush(game.active && !menuOpen, now);
  if (now - lastStatus > 250) {
    sendStatus({ modules: runtime.statuses(), capabilities: [...game.capabilities], connected: game.connected,
      players: game.entities.length, issues: game.issues });
    lastStatus = now;
  }
}
frame = requestAnimationFrame(tick);
const dispose = () => {
  if (disposed) return;
  disposed = true; cancelAnimationFrame(frame); controller.abort(); runtime.dispose(); adapter.dispose(); overlay?.dispose();
};
window.addEventListener('pagehide', event => { if (!(event as PageTransitionEvent).persisted) dispose(); }, { signal: controller.signal });
host[guard] = { dispose };
