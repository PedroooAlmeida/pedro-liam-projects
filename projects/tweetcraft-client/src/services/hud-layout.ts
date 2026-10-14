export type HudRect = Readonly<{ x: number; y: number; width: number; height: number }>;
const GAP = 12;
const intersects = (a: HudRect, b: HudRect) => a.x < b.x + b.width + GAP && a.x + a.width + GAP > b.x
  && a.y < b.y + b.height + GAP && a.y + a.height + GAP > b.y;

export function createHudLayout(width: number, height: number, obstacles: readonly HudRect[], hidden = false, minimumTop = 140) {
  const occupied = [...obstacles];
  return {
    visible: !hidden,
    reserve(requestedWidth: number, requestedHeight: number): HudRect | null {
      if (hidden || width < 80) return null;
      const w = Math.min(requestedWidth, width - GAP * 2);
      let rect: HudRect = { x: width - w - GAP, y: minimumTop, width: w, height: requestedHeight };
      for (let i = 0; i <= occupied.length; i++) {
        const collisions = occupied.filter(o => intersects(rect, o));
        if (!collisions.length) break;
        rect = { ...rect, y: Math.max(...collisions.map(o => o.y + o.height)) + GAP };
      }
      // Reserve the bottom of the screen for health, armor, food, and the hotbar.
      if (rect.y + rect.height > height - 180) return null;
      occupied.push(rect);
      return rect;
    },
  };
}
export type HudLayout = ReturnType<typeof createHudLayout>;

export function gameHudObstacles(includeLauncher = true): HudRect[] {
  const elements = [...document.querySelectorAll<HTMLElement>('#hudleft, #hudright, #world-sponsors, #touch, #chatbox, #invsearch')];
  const launcher = includeLauncher ? document.querySelector('#tweetcraft-client-ui')?.shadowRoot?.querySelector<HTMLElement>('.launcher') : null;
  if (launcher) elements.push(launcher);
  return elements.filter(el => !el.closest('[hidden]')).flatMap(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? [{ x: rect.left, y: rect.top, width: rect.width, height: rect.height }] : [];
  });
}

export function hudFrame(menuOpen = false): HudLayout {
  const hidden = menuOpen || !!document.querySelector('#screen.on, #inv:not(.off)');
  return createHudLayout(innerWidth, innerHeight, gameHudObstacles(), hidden);
}
