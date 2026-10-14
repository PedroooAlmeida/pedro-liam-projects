import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from '../src/core/runtime';
import type { ModuleContext, ModuleDefinition } from '../src/core/module';
import type { Capability } from '../src/game/types';
import { createActions } from '../src/services/actions';

const base = (capabilities: readonly Capability[] = []): Omit<ModuleContext, 'settings' | 'signal'> => ({
  now: 100, dt: .01, target: null, visible: () => true, actions: createActions({ aim: () => true, attack: () => true }),
  game: { connected: true, synced: true, active: true, position: null, selfId: 1, entities: [], camera: null,
    capabilities: new Set(capabilities), issues: [], attackRequests: 0, hitEvents: 0, deniedHits: 0 },
});
const module = (options: Partial<ModuleDefinition> = {}): ModuleDefinition => ({ id: 'test', name: 'Test', description: '', category: 'Client',
  requires: [], settings: {}, create: () => ({}), ...options });
const configure = (runtime: ReturnType<typeof createRuntime>, enabled: boolean) => runtime.apply({ version: 1, modules: { test: { enabled, values: {}, keybind: '' } } });
describe('module runtime', () => {
  it('guards duplicate IDs', () => expect(() => createRuntime([module(), module()])).toThrow('Duplicate'));
  it('enables once, cleans up on missing capabilities and re-enables when restored', () => {
    const enable = vi.fn(), disable = vi.fn(), update = vi.fn();
    const runtime = createRuntime([module({ requires: ['position'], create: () => ({ enable, disable, update }) })]);
    runtime.tick(base()); expect(enable).not.toHaveBeenCalled();
    configure(runtime, true); runtime.tick(base()); expect(runtime.statuses()[0]?.reason).toContain('position');
    runtime.tick(base(['position'])); runtime.tick(base(['position']));
    expect(enable).toHaveBeenCalledTimes(1); expect(update).toHaveBeenCalledTimes(2);
    const signal = enable.mock.calls[0]![0].signal as AbortSignal;
    runtime.tick(base()); expect(signal.aborted).toBe(true); expect(disable).toHaveBeenCalledTimes(1);
    runtime.tick(base(['position'])); expect(enable).toHaveBeenCalledTimes(2);
    configure(runtime, false); expect(disable).toHaveBeenCalledTimes(2);
    runtime.dispose(); expect(disable).toHaveBeenCalledTimes(2);
  });
  it('isolates faults, clears pending actions, and recovers through a toggle', () => {
    const update = vi.fn().mockImplementationOnce(() => { throw new Error('broken'); });
    const disable = vi.fn(), context = base();
    const cancel = vi.spyOn(context.actions, 'cancel');
    const runtime = createRuntime([module({ defaultEnabled: true, create: () => ({ update, disable }) })]);
    runtime.tick(context); runtime.tick(context);
    expect(cancel).toHaveBeenCalledWith('test'); expect(update).toHaveBeenCalledTimes(1);
    expect(runtime.statuses()[0]?.reason).toContain('broken');
    configure(runtime, false); configure(runtime, true); runtime.tick(context);
    expect(update).toHaveBeenCalledTimes(2); expect(runtime.statuses()[0]?.running).toBe(true);
    runtime.dispose();
  });
  it('reports cleanup failures and handles missing preferences', () => {
    const runtime = createRuntime([module({ defaultEnabled: true, create: () => ({ disable: () => { throw new Error('cleanup'); } }) })]);
    runtime.apply({ version: 1, modules: {} }); runtime.tick(base()); configure(runtime, false); runtime.tick(base());
    expect(runtime.statuses()[0]?.reason).toContain('Cleanup failed');
    expect(runtime.profile().modules.test?.enabled).toBe(false);
    const defaults = createRuntime([module({ settings: { count: { label: 'Count', kind: 'number', default: 1 } } })]);
    defaults.tick(base()); defaults.apply({ version: 1, modules: { test: { enabled: false, keybind: '', values: {} } } });
    expect(defaults.profile().modules.test?.values.count).toBe(1);
  });
  it('restores rendering state even when a module fails', () => {
    const render = vi.fn(), bad = vi.fn(() => { throw new Error('render'); });
    const runtime = createRuntime([module({ defaultEnabled: true, create: () => ({ render: bad }) }), module({ id: 'other', defaultEnabled: true, create: () => ({ render }) })]);
    const canvas = { save: vi.fn(), restore: vi.fn() } as unknown as CanvasRenderingContext2D;
    runtime.render(base(), canvas); expect(render).not.toHaveBeenCalled();
    runtime.tick(base()); runtime.render(base(), canvas);
    expect(render).toHaveBeenCalledTimes(1); expect(canvas.restore).toHaveBeenCalledTimes(2);
    expect(runtime.statuses()[0]?.running).toBe(false); runtime.dispose();
  });
});
