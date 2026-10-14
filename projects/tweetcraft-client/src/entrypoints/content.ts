import { createMenu } from '../ui/menu';
import { decodeStatus, sendCommand } from '../bridge/messages';
import { parseProfile, emptyProfile } from '../core/settings';

async function start() {
  if (!document.documentElement) {
    await new Promise<void>(resolve => new MutationObserver((_records, observer) => {
      if (document.documentElement) { observer.disconnect(); resolve(); }
    }).observe(document, { childList: true }));
  }
  document.getElementById('tweetcraft-client-ui')?.remove();
  let initial = emptyProfile(), storageError = '';
  try { initial = parseProfile((await chrome.storage.local.get('profile')).profile); }
  catch (error) { storageError = `Settings could not load: ${String(error)}`; }
  const menu = createMenu(initial, {
    change(profile) {
      sendCommand({ type: 'configure', profile });
      // Dispatch persistence immediately; navigation must not discard a pending debounce.
      void chrome.storage.local.set({ profile }).catch(error => menu.notice(`Settings could not save: ${String(error)}`));
    },
    open(open) { sendCommand({ type: 'menu', open }); },
  });
  if (storageError) menu.notice(storageError);
  const controller = new AbortController();
  let received = false;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const status = decodeStatus(event.data);
    if (!status) return;
    if (!received) { received = true; sendCommand({ type: 'configure', profile: menu.profile() }); }
    menu.status(status);
  }, { signal: controller.signal });
  sendCommand({ type: 'hello' });
  const timer = window.setTimeout(() => { if (!received) menu.notice('Game runtime did not respond. Reload the extension, then refresh this page.'); }, 5000);
  window.addEventListener('pagehide', event => {
    if ((event as PageTransitionEvent).persisted) return;
    controller.abort(); clearTimeout(timer); menu.dispose();
  }, { signal: controller.signal });
}
void start();
