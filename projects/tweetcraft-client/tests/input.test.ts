// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hookInput } from '../src/game/hooks/input';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });
const setup = () => {
  document.body.innerHTML = '<canvas id="gl" tabindex="0"></canvas><div id="screen"></div><canvas id="load" class="off"></canvas><div id="fatal" class="off"></div><input id="chatbox" hidden><canvas id="inv" class="off"></canvas>';
  const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;
  vi.spyOn(document, 'hasFocus').mockReturnValue(true); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
  const lock = vi.spyOn(document, 'pointerLockElement', 'get').mockReturnValue(null);
  const bounds = { x: 0, y: 0, left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, toJSON() {} };
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(bounds);
  canvas.focus(); let menu = false;
  const input = hookInput(() => menu, () => true);
  return { canvas, input, lock, menu(value: boolean) { menu = value; } };
};

describe('native game input modes', () => {
  it('permits focused embedded gameplay without pointer lock and suspends for native/client screens', () => {
    const { canvas, input, menu } = setup(); expect(input.active()).toBe(true);
    menu(true); expect(input.active()).toBe(false); menu(false);
    for (const [id, open, closed] of [['screen', 'on', ''], ['load', '', 'off'], ['fatal', '', 'off'], ['inv', '', 'off']]) {
      const node = document.getElementById(id!)!; node.className = open!; expect(input.active()).toBe(false);
      node.className = closed!; expect(input.active()).toBe(true);
    }
    const chat = document.querySelector<HTMLInputElement>('#chatbox')!;
    chat.hidden = false; expect(input.active()).toBe(false); chat.hidden = true;
    canvas.blur(); expect(input.active()).toBe(false); canvas.focus();
    vi.spyOn(document, 'hasFocus').mockReturnValue(false); expect(input.active()).toBe(false); input.dispose();
  });
  it('uses an auxiliary drag gesture with drag sensitivity and no attack/place buttons', () => {
    const { canvas, input } = setup(), buttons: number[] = [];
    let drag = false, yaw = 0;
    const down = (event: MouseEvent) => { buttons.push(event.button); drag = true; expect([event.clientX, event.clientY]).toEqual([400, 300]); };
    const move = (event: MouseEvent) => { if (drag) yaw -= event.movementX * .3 * Math.PI / 180; };
    const up = (event: MouseEvent) => { buttons.push(event.button); drag = false; };
    canvas.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    expect(input.aim(.1, 0)).toBe(true); expect(yaw).toBeCloseTo(.1); expect(buttons).toEqual([3, 3]); expect(drag).toBe(false);
    expect(input.aim(NaN, 0)).toBe(false);
    canvas.removeEventListener('mousedown', down); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); input.dispose();
  });
  it('preserves locked controls and sends attacks at the center of the game canvas', () => {
    const { canvas, input, lock } = setup(), move = vi.fn(), down = vi.fn(), up = vi.fn();
    lock.mockReturnValue(canvas); window.addEventListener('mousemove', move); canvas.addEventListener('mousedown', down); window.addEventListener('mouseup', up);
    expect(input.aim(.1, 0)).toBe(true); expect(down).not.toHaveBeenCalled();
    expect(move.mock.calls[0]![0].movementX).toBeCloseTo(-.1 / (.15 * Math.PI / 180));
    expect(input.attack()).toBe(true); expect(down.mock.calls[0]![0]).toMatchObject({ button: 0, clientX: 400, clientY: 300 });
    expect(up.mock.calls[0]![0].button).toBe(0);
    window.removeEventListener('mousemove', move); canvas.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); input.dispose();
  });
  it('reuses genuine held drags and never interrupts a held click to attack', () => {
    const { canvas, input } = setup(), down = vi.fn(), up = vi.fn();
    canvas.addEventListener('mousedown', down); window.addEventListener('mouseup', up);
    const press = new MouseEvent('mousedown', { bubbles: true, button: 0 });
    Object.defineProperty(press, 'isTrusted', { value: true }); canvas.dispatchEvent(press);
    expect(input.aim(.1, 0)).toBe(true); expect(down).toHaveBeenCalledTimes(1); expect(up).not.toHaveBeenCalled();
    expect(input.attack()).toBe(false);
    const release = new MouseEvent('mouseup', { bubbles: true, button: 0 });
    Object.defineProperty(release, 'isTrusted', { value: true }); window.dispatchEvent(release);
    expect(input.attack()).toBe(true);
    canvas.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); input.dispose();
  });
  it('waits through the native focus-click interval and disposes listeners and actions', () => {
    const { input } = setup(); let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    window.dispatchEvent(new Event('blur')); expect(input.active()).toBe(false);
    window.dispatchEvent(new Event('focus')); expect(input.active()).toBe(false);
    now = 179; expect(input.active()).toBe(false); now = 180; expect(input.active()).toBe(true);
    input.dispose(); expect(input.active()).toBe(false); expect(input.aim(.1, 0)).toBe(false); expect(input.attack()).toBe(false);
  });
  it('requires pointer lock on direct pages and suspends when the page is hidden', () => {
    const { canvas, input } = setup(); input.dispose();
    const direct = hookInput(() => false, () => false); expect(direct.active()).toBe(false);
    expect(direct.aim(.1, 0)).toBe(false); direct.dispose();
    const framed = hookInput(() => false, () => true); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    expect(framed.active()).toBe(false); canvas.blur(); framed.dispose();
  });
});
