import type { Camera, Vec3 } from '../types';
import { observeMethod } from './method';

// Terrain origin uniforms are chunk origin minus the exact interpolated camera.
// Resolve the chunk using local position; unlike a guessed eye height this also handles third person.
export function hookRenderer(position: () => Vec3 | null, report: (error: unknown) => void) {
  const uniforms = new WeakMap<WebGLUniformLocation, { name: string; program: WebGLProgram }>();
  const matrices = new WeakMap<WebGLProgram, readonly number[]>();
  let camera: Camera | null = null;
  if (typeof WebGL2RenderingContext === 'undefined') return { camera: () => camera, dispose() {} };
  const proto = WebGL2RenderingContext.prototype;
  const own = (receiver: unknown): receiver is WebGL2RenderingContext =>
    receiver instanceof WebGL2RenderingContext && receiver.canvas instanceof HTMLCanvasElement && receiver.canvas.id === 'gl';
  const cleanups = [
    observeMethod(proto, 'getUniformLocation', (receiver, args, result) => {
      if (own(receiver) && result && (args[1] === 'uVP' || args[1] === 'uOrigin')) uniforms.set(result as WebGLUniformLocation, { name: args[1], program: args[0] as WebGLProgram });
    }, report),
    observeMethod(proto, 'uniformMatrix4fv', (receiver, args) => {
      const meta = uniforms.get(args[0] as WebGLUniformLocation);
      if (!own(receiver) || meta?.name !== 'uVP' || args[1] !== false) return;
      const data = args[2] as ArrayLike<number>, offset = typeof args[3] === 'number' ? args[3] : 0;
      const matrix = Array.from({ length: 16 }, (_, i) => data[offset + i]!);
      if (matrix.every(Number.isFinite)) matrices.set(meta.program, matrix);
    }, report),
    observeMethod(proto, 'uniform3f', (receiver, args) => {
      const meta = uniforms.get(args[0] as WebGLUniformLocation);
      if (!own(receiver) || meta?.name !== 'uOrigin') return;
      const local = position();
      if (!local) return;
      const matrix = matrices.get(meta.program);
      const [x, y, z] = args.slice(1) as number[];
      if (!matrix || ![x, y, z].every(Number.isFinite)) return;
      const p = { x: Math.round((local.x + x!) / 16) * 16 - x!, y: -y!, z: Math.round((local.z + z!) / 16) * 16 - z! };
      const norm = Math.hypot(matrix[3]!, matrix[7]!, matrix[11]!);
      if (norm < .5) return;
      const rect = (receiver.canvas as HTMLCanvasElement).getBoundingClientRect();
      camera = { position: p, matrix, width: rect.width, height: rect.height,
        yaw: Math.atan2(-matrix[3]!, -matrix[11]!), pitch: Math.asin(Math.max(-1, Math.min(1, matrix[7]! / norm))),
        firstPerson: Math.hypot(p.x - local.x, p.z - local.z) < .5 && p.y - local.y > 1 && p.y - local.y < 1.9,
        updatedAt: performance.now() };
    }, report),
  ];
  return { camera: () => camera, dispose() { cleanups.reverse().forEach(fn => fn()); camera = null; } };
}
