export function createOverlay() {
  const canvas = document.createElement('canvas');
  canvas.id = 'tweetcraft-client-overlay';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Overlay canvas is unavailable');
  document.documentElement.append(canvas);
  return {
    begin() {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.round(innerWidth * ratio), height = Math.round(innerHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, innerWidth, innerHeight);
      return context;
    },
    dispose() { canvas.remove(); },
  };
}
