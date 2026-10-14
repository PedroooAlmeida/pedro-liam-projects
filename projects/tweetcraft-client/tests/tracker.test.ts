import { describe, expect, it } from 'vitest';
import { createTracker } from '../src/game/protocol/tracker';

const relay = (ids: number[], full = false, events?: unknown) => {
  const tail = events === undefined ? new Uint8Array() : new TextEncoder().encode(JSON.stringify(events));
  const buffer = new ArrayBuffer(5 + ids.length * 19 + tail.length), view = new DataView(buffer);
  view.setUint8(0, full ? 6 : 5); view.setUint16(1, ids.length, true);
  ids.forEach((id, i) => { const o = 5 + i * 19; view.setUint16(o, id, true); view.setFloat32(o + 2, 3, true); view.setFloat32(o + 6, 65, true); view.setFloat32(o + 10, 5, true); view.setUint8(o + 18, 1); });
  new Uint8Array(buffer).set(tail, 5 + ids.length * 19); return buffer;
};
const setup = () => { const tracker = createTracker(); tracker.open(); tracker.outgoing('{"t":"hello","v":5}'); return tracker; };
describe('Tweetcraft protocol 5', () => {
  it('ignores data until the version is recognized', () => {
    const tracker = createTracker(); tracker.incoming(relay([2]), 0); expect(tracker.state(0).players).toEqual([]);
    tracker.outgoing('{"t":"hello","v":6}'); expect(tracker.state(0).issue).toContain('Unsupported');
    tracker.outgoing(null); tracker.outgoing('x'.repeat(200001)); tracker.outgoing('[]');
    tracker.outgoing('bad'); expect(tracker.state(0).issue).toContain('JSON');
  });
  it('tracks metadata, deltas, full snapshots, stationary players, and disconnects', () => {
    const tracker = setup();
    tracker.incoming(JSON.stringify({ t: 'welcome', id: 1, players: [{ id: 1, name: 'Me' }, { id: 2, h: 'Friend' }, { id: 3, name: 'Other' }, { id: -1 }, null] }), 0);
    tracker.incoming('{"t":"synced"}', 0); tracker.incoming(relay([1, 2, 3]), 100);
    expect(tracker.state(100).players.map(p => p.name)).toEqual(['@Friend', 'Other']);
    tracker.incoming(relay([2], true), 200); expect(tracker.state(200).players).toHaveLength(1);
    expect(tracker.state(2300).players).toHaveLength(1);
    tracker.incoming(relay([]), 2300);
    expect(tracker.state(60000).players[0]?.name).toBe('@Friend');
    tracker.incoming(relay([], true), 60000);
    expect(tracker.state(60000).players).toHaveLength(0);
    tracker.incoming(JSON.stringify({ t: 'who', p: { id: 2, name: 'Renamed' } }), 2300);
    tracker.incoming(relay([2]), 2400); expect(tracker.state(2400).players[0]?.name).toBe('Renamed');
    tracker.incoming('{"t":"leave","id":2}', 2400); expect(tracker.state(2400).players).toHaveLength(0);
    tracker.close(); expect(tracker.state(2500).connected).toBe(false);
  });
  it('parses relay events and distinguishes requests from server hurt events', () => {
    const tracker = setup(); tracker.outgoing('{"t":"attack"}');
    tracker.incoming(relay([2], false, [{ t: 'join', p: { id: 3 } }, { t: 'phurt' }, { t: 'hitdeny' }]), 0);
    expect(tracker.state(0)).toMatchObject({ attackRequests: 1, hitEvents: 1, deniedHits: 1 });
    tracker.incoming(relay([3]), 10); expect(tracker.state(10).players[1]?.name).toBe('Player 3');
  });
  it('handles malformed and unrelated frames without throwing', () => {
    const tracker = setup();
    for (const data of [null, [], 'pong', '[]', 'not json', new ArrayBuffer(0), new Uint8Array([9]).buffer,
      new Uint8Array([5]).buffer, new Uint8Array([5,1,0,0,0]).buffer]) tracker.incoming(data, 0);
    expect(tracker.state(0).issue).toContain('Truncated');
    const bad = relay([2]); new DataView(bad).setFloat32(7, NaN, true); tracker.incoming(bad, 0);
    expect(tracker.state(0).players).toHaveLength(0);
    const malformed = new Uint8Array(6); malformed[0] = 5; malformed[5] = 123;
    tracker.incoming(malformed.buffer, 0); expect(tracker.state(0).issue).toContain('events');
    tracker.incoming('x'.repeat(2_000_001), 0);
    tracker.incoming('{"t":"old"}', 0); expect(tracker.state(0).synced).toBe(false);
  });
});
