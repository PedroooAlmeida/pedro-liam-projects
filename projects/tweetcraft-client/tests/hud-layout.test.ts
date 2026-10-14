// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHudLayout, gameHudObstacles, hudFrame } from '../src/services/hud-layout';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
describe('HUD placement', () => {
  it('stacks widgets on the right without intersecting native controls', () => {
    const layout = createHudLayout(1200, 1000, [
      { x: 1080, y: 10, width: 110, height: 160 },
      { x: 10, y: 50, width: 190, height: 200 },
    ]);
    const first = layout.reserve(370, 28)!, second = layout.reserve(370, 80)!;
    expect(first).toEqual({ x: 818, y: 182, width: 370, height: 28 });
    expect(second.y).toBe(first.y + first.height + 12);
    expect(first.x).toBeGreaterThan(200);
  });
  it('preserves the hotbar area and hides widgets if no space remains', () => {
    expect(createHudLayout(800, 350, []).reserve(370, 80)).toBeNull();
    expect(createHudLayout(50, 1000, []).reserve(370, 80)).toBeNull();
    expect(createHudLayout(300, 1000, []).reserve(370, 28)?.width).toBe(276);
    expect(createHudLayout(800, 1000, [], true).reserve(370, 28)).toBeNull();
  });
  it('uses visible native HUD elements, not their full-screen parent canvas', () => {
    document.body.innerHTML = '<div id="hudtop"><div id="hudright"></div></div><aside id="world-sponsors" hidden></aside>';
    vi.spyOn(document.querySelector('#hudright')!, 'getBoundingClientRect').mockReturnValue({ left: 800, top: 10, width: 100, height: 80 } as DOMRect);
    expect(gameHudObstacles()).toEqual([{ x: 800, y: 10, width: 100, height: 80 }]);
    expect(hudFrame().visible).toBe(true);
    document.body.insertAdjacentHTML('beforeend', '<div id="screen" class="on"></div>');
    expect(hudFrame().visible).toBe(false); expect(hudFrame(true).visible).toBe(false);
  });
});
