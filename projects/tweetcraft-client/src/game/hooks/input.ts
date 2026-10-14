const framed = () => { try { return window.top !== window; } catch { return true; } };

export function hookInput(isMenuOpen: () => boolean, isFramed: () => boolean = framed) {
  const controller = new AbortController(), held = new Set<number>();
  let focusAt = -Infinity, disposed = false;
  const canvas = () => document.querySelector<HTMLCanvasElement>('#gl');
  const options = { signal: controller.signal, capture: true };
  window.addEventListener('mousedown', event => {
    if (event.isTrusted && event.target === canvas() && event.button !== 1) held.add(event.button);
  }, options);
  window.addEventListener('mouseup', event => { if (event.isTrusted) held.delete(event.button); }, options);
  window.addEventListener('blur', () => { held.clear(); focusAt = Infinity; }, options);
  window.addEventListener('focus', () => { focusAt = performance.now(); }, options);
  const active = () => {
    const game = canvas();
    if (disposed || !game || isMenuOpen() || document.hidden || !document.hasFocus()
      || document.querySelector('#screen.on, #load:not(.off), #fatal:not(.off), #inv:not(.off), #chatbox:not([hidden])')) return false;
    if (document.pointerLockElement === game) return true;
    return !document.pointerLockElement && isFramed() && document.activeElement === game && performance.now() - focusAt >= 80;
  };
  const point = (game: HTMLCanvasElement) => {
    const rect = game.getBoundingClientRect();
    return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
  };
  return {
    active,
    aim(yaw: number, pitch: number) {
      const game = canvas();
      if (!active() || !game || ![yaw, pitch].every(Number.isFinite)) return false;
      const gesture = document.pointerLockElement !== game && held.size === 0, coordinates = point(game);
      // Auxiliary button 3 creates native drag state without attack, place, or pick.
      if (gesture) game.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 3, ...coordinates }));
      try {
        const sensitivity = (document.pointerLockElement === game ? .15 : .3) * Math.PI / 180;
        const event = new MouseEvent('mousemove', { bubbles: true, ...coordinates });
        Object.defineProperties(event, { movementX: { value: -yaw / sensitivity }, movementY: { value: -pitch / sensitivity } });
        window.dispatchEvent(event);
      } finally {
        if (gesture) window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 3, ...coordinates }));
      }
      return true;
    },
    attack() {
      const game = canvas();
      if (!active() || !game || held.size > 0) return false;
      const coordinates = point(game);
      try { game.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1, ...coordinates })); }
      finally { window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, buttons: 0, ...coordinates })); }
      return true;
    },
    dispose() { disposed = true; held.clear(); controller.abort(); },
  };
}
