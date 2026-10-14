// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOverlay } from '../src/services/overlay';

afterEach(() => { vi.restoreAllMocks(); document.querySelector('#tweetcraft-client-overlay')?.remove(); });
describe('shared overlay', () => {
  it('sizes for device pixels, clears every frame, and removes itself', () => {
    const ctx = { setTransform: vi.fn(), clearRect: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const overlay = createOverlay(); expect(overlay.begin()).toBe(ctx); overlay.begin();
    expect(ctx.clearRect).toHaveBeenCalledTimes(2); expect(document.querySelector('#tweetcraft-client-overlay')).not.toBeNull();
    overlay.dispose(); expect(document.querySelector('#tweetcraft-client-overlay')).toBeNull();
  });
  it('reports unavailable canvas contexts', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(createOverlay).toThrow('unavailable');
  });
});
