import { definitions } from '../modules/registry';
import { settingsValues, type Profile } from '../core/settings';
import type { Status } from '../bridge/messages';
import { styles } from './styles';
import { createHudLayout, gameHudObstacles } from '../services/hud-layout';

export function createMenu(initial: Profile, callbacks: { change(profile: Profile): void; open(value: boolean): void }) {
  let profile = initial, open = false, category = 'All', disposed = false;
  const controller = new AbortController(), signal = controller.signal;
  const host = document.createElement('div');
  host.id = 'tweetcraft-client-ui'; host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = styles; shadow.append(style);
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
  };
  const launcher = element('button', 'launcher', 'TC  /  Right Shift'); launcher.style.pointerEvents = 'auto';
  launcher.setAttribute('aria-label', 'Open Tweetcraft Client');
  const panel = element('section', 'panel'); panel.style.pointerEvents = 'auto'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Tweetcraft Client');
  const header = element('div', 'header'); header.append(element('span', 'brand', 'Tweetcraft Client'), element('span', 'tag', 'DEV 0.3.1'));
  const close = element('button', 'close', '×'); close.setAttribute('aria-label', 'Close menu'); header.append(close);
  const tools = element('div', 'tools'), search = element('input', 'search'), panic = element('button', 'panic', 'Disable all');
  search.placeholder = 'Find a module…'; search.setAttribute('aria-label', 'Search modules'); tools.append(search, panic);
  const tabs = element('div', 'tabs'); tabs.setAttribute('role', 'tablist');
  const list = element('div', 'modules'), footer = element('div', 'footer');
  const notice = element('div', 'notice');
  panel.append(header, tools, tabs, list, footer); shadow.append(launcher, panel); document.documentElement.append(host);
  const positionLauncher = () => {
    const box = launcher.getBoundingClientRect();
    const slot = createHudLayout(innerWidth, innerHeight, gameHudObstacles(false), false, 16).reserve(box.width || 160, box.height || 38);
    launcher.style.top = `${slot?.y ?? 100}px`;
    launcher.style.right = '12px';
  };
  positionLauncher();
  const positionTimer = window.setInterval(positionLauncher, 500);
  const controls = new Map<string, { card: HTMLDivElement; toggle: HTMLInputElement; state: HTMLDivElement; fields: Map<string, HTMLInputElement>; keybind: HTMLSelectElement }>();
  const preference = (id: string) => profile.modules[id]!;
  const publish = () => callbacks.change(profile);
  const setPreference = (id: string, change: Partial<Profile['modules'][string]>) => {
    profile = { version: 1, modules: { ...profile.modules, [id]: { ...preference(id), ...change } } }; publish();
  };
  const filter = () => {
    const query = search.value.toLowerCase();
    for (const definition of definitions) controls.get(definition.id)!.card.hidden =
      category !== 'All' && definition.category !== category || !`${definition.name} ${definition.description}`.toLowerCase().includes(query);
    for (const tab of tabs.querySelectorAll('button')) tab.setAttribute('aria-selected', String(tab.textContent === category));
  };
  const setOpen = (value: boolean) => {
    open = value; panel.hidden = !open; launcher.hidden = open; callbacks.open(value);
    if (value) {
      if (document.pointerLockElement) document.exitPointerLock();
      window.dispatchEvent(new Event('blur'));
      search.focus();
    } else document.querySelector<HTMLElement>('#gl')?.focus();
  };
  for (const name of ['All', 'Combat', 'Render', 'Client', 'Movement']) {
    const tab = element('button', 'tab', name); tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => { category = name; filter(); }, { signal }); tabs.append(tab);
  }
  for (const definition of definitions) {
    const saved = profile.modules[definition.id];
    profile = { version: 1, modules: { ...profile.modules, [definition.id]: {
      enabled: saved?.enabled ?? definition.defaultEnabled ?? false, keybind: saved?.keybind ?? '',
      values: settingsValues(definition.settings, saved?.values),
    } } };
    const card = element('div', 'module'), row = element('label', 'row'), toggle = element('input', 'toggle');
    toggle.type = 'checkbox'; toggle.checked = preference(definition.id).enabled;
    row.append(element('span', 'name', definition.name), toggle);
    const state = element('div', 'state', 'Waiting for runtime');
    card.append(row, element('div', 'description', definition.description), state);
    toggle.addEventListener('change', () => setPreference(definition.id, { enabled: toggle.checked }), { signal });
    const settings = element('div', 'settings'), fields = new Map<string, HTMLInputElement>();
    for (const [key, setting] of Object.entries(definition.settings)) {
      const label = element('label', 'setting', setting.label), input = element('input');
      input.type = setting.kind === 'boolean' ? 'checkbox' : 'number';
      if (setting.kind === 'boolean') input.checked = Boolean(preference(definition.id).values[key]);
      else { input.value = String(preference(definition.id).values[key]); input.min = String(setting.min); input.max = String(setting.max); input.step = String(setting.step); }
      input.addEventListener('change', () => {
        const values = settingsValues(definition.settings, { ...preference(definition.id).values, [key]: setting.kind === 'boolean' ? input.checked : input.valueAsNumber });
        setPreference(definition.id, { values }); input.value = String(values[key]);
      }, { signal });
      fields.set(key, input); label.append(input); settings.append(label);
    }
    const keyLabel = element('label', 'setting', 'Keybind'), keybind = element('select');
    for (const key of ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(k => `Key${k}`)]) {
      const option = element('option', '', key ? key.slice(3) : 'None'); option.value = key; keybind.append(option);
    }
    keybind.value = preference(definition.id).keybind;
    keybind.addEventListener('change', () => setPreference(definition.id, { keybind: keybind.value }), { signal });
    keyLabel.append(keybind); settings.append(keyLabel); card.append(settings); list.append(card);
    controls.set(definition.id, { card, toggle, state, fields, keybind });
  }
  footer.append(element('div', 'hint', 'Right Shift · menu  /  Escape · close  /  Resume through the game after closing'), notice);
  const statusLine = element('div', '', 'Waiting for game runtime…'); footer.prepend(statusLine);
  const onKey = (event: KeyboardEvent) => {
    if (event.code === 'ShiftRight' && !event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); setOpen(!open); return; }
    if (open) {
      event.stopPropagation();
      if (event.code === 'Escape') { event.preventDefault(); setOpen(false); }
      return;
    }
    const target = event.composedPath()[0];
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    const matches = definitions.filter(d => preference(d.id).keybind === event.code);
    if (matches.length) {
      event.preventDefault(); event.stopImmediatePropagation();
      for (const module of matches) setPreference(module.id, { enabled: !preference(module.id).enabled });
      for (const module of matches) controls.get(module.id)!.toggle.checked = preference(module.id).enabled;
    }
  };
  window.addEventListener('keydown', onKey, { capture: true, signal });
  // Consume the matching keyup as well, so opening the menu cannot start sneaking.
  window.addEventListener('keyup', event => { if (open || event.code === 'ShiftRight') event.stopImmediatePropagation(); }, { capture: true, signal });
  launcher.addEventListener('click', () => setOpen(true), { signal });
  close.addEventListener('click', () => setOpen(false), { signal });
  search.addEventListener('input', filter, { signal });
  panic.addEventListener('click', () => {
    profile = { version: 1, modules: Object.fromEntries(Object.entries(profile.modules).map(([id, p]) => [id, { ...p, enabled: false }])) };
    for (const control of controls.values()) control.toggle.checked = false;
    publish();
  }, { signal });
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  header.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = panel.getBoundingClientRect(); drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }; header.setPointerCapture(event.pointerId);
  }, { signal });
  header.addEventListener('pointermove', event => {
    if (!drag) return;
    panel.style.left = `${Math.max(0, Math.min(innerWidth - panel.offsetWidth, drag.left + event.clientX - drag.x))}px`;
    panel.style.top = `${Math.max(0, Math.min(innerHeight - 50, drag.top + event.clientY - drag.y))}px`;
  }, { signal });
  header.addEventListener('pointerup', () => { drag = null; }, { signal });
  filter();
  return {
    profile: () => profile,
    status(status: Status) {
      if (disposed) return;
      statusLine.textContent = `${status.connected ? 'Connected' : 'Connecting'} · ${status.players} players / ${status.mobs ?? 0} mobs · ${status.capabilities.join(' / ') || 'Hooks pending'}`;
      for (const module of status.modules) {
        const control = controls.get(module.id);
        if (!control) continue;
        control.state.textContent = module.reason || (module.running ? 'RUNNING' : 'OFF');
        control.state.dataset.running = String(module.running);
      }
    },
    notice(text: string) { notice.textContent = text; },
    dispose() { disposed = true; controller.abort(); clearInterval(positionTimer); host.remove(); },
  };
}
