import { hookEngine } from './hooks/engine';
import { hookRenderer } from './hooks/renderer';
import { hookNetwork } from './hooks/network';
import type { Capability, GameAdapter } from './types';

export function createAdapter(isMenuOpen: () => boolean): GameAdapter {
  const issues: string[] = [];
  const report = (error: unknown) => { const text = String(error).slice(0, 160); if (!issues.includes(text)) { issues.push(text); if (issues.length > 5) issues.shift(); } };
  const engine = hookEngine(report), renderer = hookRenderer(engine.position, report), network = hookNetwork(report);
  const active = () => !isMenuOpen() && !document.hidden && document.hasFocus()
    && document.pointerLockElement?.id === 'gl'
    && !document.querySelector<HTMLInputElement>('#chatbox:not([hidden])')
    && !document.querySelector('#inv:not(.off)');
  return {
    snapshot(now) {
      const net = network.state(now), position = engine.position();
      const latest = renderer.camera(), camera = latest && now - latest.updatedAt < 250 ? latest : null;
      const capabilities = new Set<Capability>();
      if (position) capabilities.add('position');
      if (engine.ready()) capabilities.add('world');
      if (net.compatible && net.connected && net.synced) capabilities.add('entities');
      if (camera) capabilities.add('camera');
      const ready = active() && net.connected && net.synced && !!camera?.firstPerson;
      // Synthetic mouse events exercise Tweetcraft's own controls; server results remain separately observable.
      if (ready) { capabilities.add('aim'); capabilities.add('attack'); }
      return { connected: net.connected, synced: net.synced, active: ready, selfId: net.selfId, position, entities: net.players,
        camera, capabilities, issues: [...issues, ...(net.issue ? [net.issue] : [])],
        attackRequests: net.attackRequests, hitEvents: net.hitEvents, deniedHits: net.deniedHits };
    },
    aim(yaw, pitch) {
      if (!active() || ![yaw, pitch].every(Number.isFinite)) return false;
      const event = new MouseEvent('mousemove', { bubbles: true });
      const sensitivity = .15 * Math.PI / 180;
      Object.defineProperties(event, { movementX: { value: -yaw / sensitivity }, movementY: { value: -pitch / sensitivity } });
      window.dispatchEvent(event);
      return true;
    },
    attack() {
      const canvas = document.querySelector('#gl');
      if (!active() || !canvas) return false;
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, buttons: 0 }));
      return true;
    },
    visible: engine.visible,
    dispose() { network.dispose(); renderer.dispose(); engine.dispose(); },
  };
}
