import { engineBytes } from './engine';

// Development-only fixture served on loopback. This is not part of the extension build.
const storage = {
  async get(key: string) { return { [key]: JSON.parse(localStorage.getItem(key) || 'null') as unknown }; },
  async set(value: Record<string, unknown>) { for (const [key, v] of Object.entries(value)) localStorage.setItem(key, JSON.stringify(v)); },
};
Object.assign(window.chrome, { storage: { local: storage } });
class FixtureSocket extends EventTarget {
  readyState = 0;
  constructor(_url: string) { super(); queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }); }
  send(data: string) {
    const message = JSON.parse(data) as { t: string };
    if (message.t === 'hello') {
      this.receive(JSON.stringify({ t: 'welcome', id: 1, players: [{ id: 2, name: 'Practice target' }] }));
      this.receive('{"t":"synced"}');
    }
    if (message.t === 'attack') this.receive('{"t":"phurt","id":2}');
  }
  receive(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data })); }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
}
window.WebSocket = FixtureSocket as unknown as typeof WebSocket;

async function start() {
  // Production scripts execute after the authored game globals exist, before engine startup.
  for (const src of ['/main.js', '/content.js']) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script'); script.src = src; script.onload = () => resolve(); script.onerror = reject; document.head.append(script);
    });
  }
  const { instance } = await WebAssembly.instantiate(engineBytes());
  const memory = instance.exports.memory as WebAssembly.Memory;
  const state = new Float64Array(memory.buffer, 0, 12); state.set([8, 64, 8]);
  const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;
  const gl = canvas.getContext('webgl2')!;
  const shader = (type: number, source: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s); return s; };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\nuniform mat4 uVP;uniform vec3 uOrigin;void main(){gl_Position=uVP*vec4(uOrigin,1.0);gl_PointSize=5.0;}'));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.4,0.8,0.7,1.0);}'));
  gl.linkProgram(program); gl.useProgram(program);
  const matrixLocation = gl.getUniformLocation(program, 'uVP'), originLocation = gl.getUniformLocation(program, 'uOrigin');
  const socket = new WebSocket(`ws://${location.host}/ws/abcdefghijklmnop`);
  socket.addEventListener('open', () => socket.send('{"t":"hello","v":5}'));
  let yaw = 0, pitch = 0;
  const sensitivity = .15 * Math.PI / 180;
  window.addEventListener('mousemove', event => {
    if (document.pointerLockElement !== canvas) return;
    yaw -= event.movementX * sensitivity; pitch = Math.max(-1.5, Math.min(1.5, pitch - event.movementY * sensitivity));
  });
  canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) void canvas.requestPointerLock(); });
  canvas.addEventListener('mousedown', () => { if (document.pointerLockElement === canvas) socket.send('{"t":"attack","id":2}'); });
  const mul = (a: number[], b: number[]) => Array.from({ length: 16 }, (_, i) => {
    const row = i % 4, column = Math.floor(i / 4); return [0,1,2,3].reduce((sum, k) => sum + a[k * 4 + row]! * b[column * 4 + k]!, 0);
  });
  let moving = false;
  document.querySelector('#move-target')!.addEventListener('click', () => { moving = !moving; });
  document.querySelector('#disconnect')!.addEventListener('click', () => socket.close());
  document.querySelector('#move-player')!.addEventListener('click', () => { state[0]! += 1; });
  const draw = (now: number) => {
    canvas.width = innerWidth; canvas.height = innerHeight; gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(.07, .13, .19, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const f = 1 / Math.tan(70 * Math.PI / 360), c = Math.cos(-pitch), s = Math.sin(-pitch), cy = Math.cos(-yaw), sy = Math.sin(-yaw);
    const perspective = [f / (innerWidth / innerHeight),0,0,0,0,f,0,0,0,0,-1.0003,-1,0,0,-.1,0];
    const view = mul([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1], [cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
    gl.uniformMatrix4fv(matrixLocation, false, new Float32Array(mul(perspective, view)));
    gl.uniform3f(originLocation, -state[0]!, -state[1]! - 1.62, -state[2]!);
    gl.drawArrays(gl.POINTS, 0, 1);
    if (socket.readyState === 1) {
      const buf = new ArrayBuffer(24), v = new DataView(buf); v.setUint8(0, 6); v.setUint16(1, 1, true); v.setUint16(5, 2, true);
      v.setFloat32(7, 8 + (moving ? Math.sin(now / 1000) * 2 : 0), true); v.setFloat32(11, 64, true); v.setFloat32(15, 5.2, true);
      (socket as unknown as FixtureSocket).receive(buf);
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
void start().catch(error => { document.querySelector('#failure')!.textContent = String(error); });
