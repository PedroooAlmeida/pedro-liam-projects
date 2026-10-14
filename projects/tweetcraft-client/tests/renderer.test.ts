// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hookRenderer } from '../src/game/hooks/renderer';

class FixtureGL {
  canvas = document.createElement('canvas');
  constructor() { this.canvas.id = 'gl'; }
  getUniformLocation(_p: object, _n: string) { return {}; }
  uniformMatrix4fv(_location: object, _transpose: boolean, _data: number[] | Float32Array, _offset = 0) {}
  uniform3f(_location: object, _x: number, _y: number, _z: number) {}
}
afterEach(() => vi.unstubAllGlobals());
describe('terrain camera observation', () => {
  it('reconstructs exact camera, recognizes third person, and restores methods', () => {
    vi.stubGlobal('WebGL2RenderingContext', FixtureGL);
    const gl = new FixtureGL(), original = gl.uniform3f, report = vi.fn();
    vi.spyOn(gl.canvas, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600 } as DOMRect);
    const hook = hookRenderer(() => ({ x: 100, y: 64, z: 100 }), report), program = {};
    const matrix = gl.getUniformLocation(program, 'uVP'), origin = gl.getUniformLocation(program, 'uOrigin');
    gl.uniformMatrix4fv(matrix, false, [1,0,0,0,0,1,0,0,0,0,-1,-1,0,0,-.1,0]);
    gl.uniform3f(origin, 12, -65.62, 12);
    expect(hook.camera()).toMatchObject({ position: { x: 100, y: 65.62, z: 100 }, width: 800, firstPerson: true, pitch: 0 });
    expect(hook.camera()?.yaw).toBeCloseTo(0);
    gl.uniform3f(origin, 8, -65.62, 12); expect(hook.camera()?.firstPerson).toBe(false);
    hook.dispose(); expect(gl.uniform3f).toBe(original); expect(hook.camera()).toBeNull(); expect(report).not.toHaveBeenCalled();
  });
  it('ignores other contexts, missing local state, and invalid uniforms', () => {
    vi.stubGlobal('WebGL2RenderingContext', FixtureGL);
    const gl = new FixtureGL(), program = {}, hook = hookRenderer(() => null, vi.fn());
    const origin = gl.getUniformLocation(program, 'uOrigin');
    gl.uniform3f(origin, 1, 2, 3); expect(hook.camera()).toBeNull(); hook.dispose();
    const other = hookRenderer(() => ({ x: 0, y: 0, z: 0 }), vi.fn());
    const matrix = gl.getUniformLocation(program, 'uVP'), loc = gl.getUniformLocation(program, 'uOrigin');
    gl.uniform3f(loc, 0, 0, 0); expect(other.camera()).toBeNull();
    gl.uniformMatrix4fv(matrix, false, new Float32Array(16)); gl.uniform3f(loc, 0, 0, 0); expect(other.camera()).toBeNull();
    gl.uniformMatrix4fv(matrix, false, new Float32Array(16).fill(NaN));
    gl.canvas.id = 'other'; gl.getUniformLocation(program, 'uVP'); gl.uniform3f(loc, 0, 0, 0);
    expect(other.camera()).toBeNull(); other.dispose();
    vi.stubGlobal('WebGL2RenderingContext', undefined);
    const missing = hookRenderer(() => null, vi.fn()); expect(missing.camera()).toBeNull(); missing.dispose();
  });
});
