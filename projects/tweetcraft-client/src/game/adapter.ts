import { hookEngine } from './hooks/engine';
import { hookRenderer } from './hooks/renderer';
import { hookNetwork } from './hooks/network';
import { hookInput } from './hooks/input';
import type { Capability, GameAdapter } from './types';

export function createAdapter(isMenuOpen: () => boolean): GameAdapter {
  const issues: string[] = [];
  const report = (error: unknown) => { const text = String(error).slice(0, 160); if (!issues.includes(text)) { issues.push(text); if (issues.length > 5) issues.shift(); } };
  const input = hookInput(isMenuOpen), active = input.active;
  const engine = hookEngine(report, active), renderer = hookRenderer(engine.position, report), network = hookNetwork(report);
  return {
    snapshot(now) {
      const net = network.state(now), position = engine.position();
      const latest = renderer.camera(), camera = latest && now - latest.updatedAt < 250 ? latest : null;
      const capabilities = new Set<Capability>();
      if (position) capabilities.add('position');
      if (engine.ready()) capabilities.add('world');
      if (engine.canFly()) capabilities.add('flight');
      if (net.canSync && net.compatible && net.connected && net.synced) capabilities.add('movement-sync');
      if (net.compatible && net.connected && net.synced) capabilities.add('entities');
      if (camera) capabilities.add('camera');
      const ready = active() && net.connected && net.synced && !!camera?.firstPerson;
      // Synthetic mouse events exercise Tweetcraft's own controls; server results remain separately observable.
      if (ready) { capabilities.add('aim'); capabilities.add('attack'); }
      return { connected: net.connected, synced: net.synced, active: ready, selfId: net.selfId, position, entities: [...net.players, ...net.mobs],
        camera, capabilities, issues: [...issues, ...(net.issue ? [net.issue] : [])],
        attackRequests: net.attackRequests, hitEvents: net.hitEvents, deniedHits: net.deniedHits, movement: net.movement };
    },
    aim: input.aim,
    attack: input.attack,
    visible: engine.visible,
    flight: engine.flight,
    groundSpeed: engine.groundSpeed,
    syncPosition(now) {
      const position = engine.position(), camera = renderer.camera();
      if (!active() || !position || !camera?.firstPerson || now - camera.updatedAt < 0 || now - camera.updatedAt >= 250) return false;
      return network.sync(position, camera, now);
    },
    dispose() { input.dispose(); network.dispose(); renderer.dispose(); engine.dispose(); },
  };
}
