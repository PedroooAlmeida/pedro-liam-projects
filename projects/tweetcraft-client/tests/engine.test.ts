import { afterEach, describe, expect, it, vi } from 'vitest';
import { hookEngine } from '../src/game/hooks/engine';
import { observeMethod } from '../src/game/hooks/method';
import { engineBytes } from './fixtures/engine';

afterEach(() => vi.restoreAllMocks());
describe('engine hook', () => {
  it('captures real WASM exports, follows memory growth, and restores hooks', async () => {
    const original = WebAssembly.instantiate, report = vi.fn(), hook = hookEngine(report);
    expect(hook.ready()).toBe(false); expect(hook.position()).toBeNull();
    expect(hook.visible({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBe(false);
    const { instance } = await WebAssembly.instantiate(engineBytes());
    await Promise.resolve();
    const memory = instance.exports.memory as WebAssembly.Memory;
    new Float64Array(memory.buffer, 0, 12).set([10, 64, 20]);
    expect(hook.position()).toEqual({ x: 10, y: 64, z: 20 });
    memory.grow(1); new Float64Array(memory.buffer, 0, 12).set([11, 65, 21]);
    expect(hook.position()).toEqual({ x: 11, y: 65, z: 21 });
    const from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 3 };
    expect(hook.visible(from, to)).toBe(true);
    new Uint8Array(memory.buffer)[256] = 1; expect(hook.visible(from, to)).toBe(false);
    expect(hook.visible(from, { ...to, z: 200 })).toBe(false);
    new Float64Array(memory.buffer)[0] = NaN; expect(hook.position()).toBeNull();
    hook.dispose(); expect(WebAssembly.instantiate).toBe(original); expect(report).not.toHaveBeenCalled();
  });
  it('preserves the Module overload and ignores unrelated engines', async () => {
    const report = vi.fn(), hook = hookEngine(report);
    const module = await WebAssembly.compile(engineBytes());
    const instance = await WebAssembly.instantiate(module);
    await Promise.resolve(); expect(instance).toBeInstanceOf(WebAssembly.Instance); expect(hook.ready()).toBe(true);
    hook.dispose();
    const other = hookEngine(report);
    await WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0]));
    await Promise.resolve(); expect(other.ready()).toBe(false); other.dispose();
  });
  it('preserves native failures and reports rejected initialization', async () => {
    const report = vi.fn(), hook = hookEngine(report);
    await expect(WebAssembly.instantiate(new Uint8Array([1]))).rejects.toThrow();
    await Promise.resolve(); expect(report).toHaveBeenCalled(); hook.dispose();
  });
});
describe('transparent method interception', () => {
  it('preserves receiver, arguments and result when observers fail', () => {
    const object = { n: 3, fn(amount: number) { return this.n + amount; } };
    const original = object.fn, report = vi.fn();
    const cleanup = observeMethod(object, 'fn', () => { throw new Error('observer'); }, report);
    expect(object.fn(4)).toBe(7); expect(report).toHaveBeenCalled(); cleanup(); expect(object.fn).toBe(original);
    expect(() => observeMethod({ n: 3 }, 'n', () => {}, report)).toThrow('Missing');
  });
  it('does not remove another hook installed afterward', () => {
    const object = { fn: () => 1 }, cleanup = observeMethod(object, 'fn', () => {}, () => {});
    object.fn = () => 2; cleanup(); expect(object.fn()).toBe(2);
  });
});
