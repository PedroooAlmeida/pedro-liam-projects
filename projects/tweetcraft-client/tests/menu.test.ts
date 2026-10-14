// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMenu } from '../src/ui/menu';
import { emptyProfile } from '../src/core/settings';

afterEach(() => { document.body.innerHTML = ''; document.getElementById('tweetcraft-client-ui')?.remove(); });
describe('in-game menu', () => {
  it('toggles, filters, saves validated settings and keybinds, and disables all modules', () => {
    const change = vi.fn(), open = vi.fn(), menu = createMenu(emptyProfile(), { change, open });
    const shadow = document.querySelector('#tweetcraft-client-ui')!.shadowRoot!;
    const click = (selector: string) => shadow.querySelector<HTMLButtonElement>(selector)!.click();
    click('.launcher'); expect(open).toHaveBeenLastCalledWith(true);
    const search = shadow.querySelector<HTMLInputElement>('.search')!;
    search.value = 'aim'; search.dispatchEvent(new Event('input'));
    expect([...shadow.querySelectorAll<HTMLElement>('.module')].filter(el => !el.hidden)).toHaveLength(1);
    search.value = ''; search.dispatchEvent(new Event('input'));
    shadow.querySelectorAll<HTMLButtonElement>('.tab')[1]!.click();
    expect([...shadow.querySelectorAll<HTMLElement>('.module')].filter(el => !el.hidden)).toHaveLength(3);
    const aim = shadow.querySelectorAll('.module')[4]!;
    const speed = aim.querySelector<HTMLInputElement>('input[type=number]')!;
    speed.value = '10000'; speed.dispatchEvent(new Event('change')); expect(menu.profile().modules['aim-assist']!.values.speed).toBe(360);
    aim.querySelector<HTMLInputElement>('.toggle')!.click(); expect(menu.profile().modules['aim-assist']!.enabled).toBe(true);
    const bind = aim.querySelector('select')!; bind.value = 'KeyR'; bind.dispatchEvent(new Event('change'));
    click('.close'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(menu.profile().modules['aim-assist']!.enabled).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftRight' })); expect(open).toHaveBeenLastCalledWith(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); expect(open).toHaveBeenLastCalledWith(false);
    click('.launcher'); click('.panic'); expect(Object.values(menu.profile().modules).every(p => !p.enabled)).toBe(true);
    menu.status({ modules: [{ id: 'aim-assist', running: false, reason: 'Waiting for camera' } as never], capabilities: [], players: 0, connected: false, issues: [] });
    expect(aim.querySelector('.state')!.textContent).toBe('Waiting for camera');
    menu.notice('Storage unavailable'); expect(shadow.textContent).toContain('Storage unavailable');
    menu.dispose(); expect(document.querySelector('#tweetcraft-client-ui')).toBeNull();
    menu.status({ modules: [], capabilities: [], players: 0, connected: true, issues: [] });
  });
  it('does not fire module hotkeys while typing or repeating', () => {
    const menu = createMenu({ version: 1, modules: { coordinates: { enabled: true, keybind: 'KeyR', values: {} } } }, { change: vi.fn(), open: vi.fn() });
    const input = document.createElement('input'); document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', ctrlKey: true }));
    expect(menu.profile().modules.coordinates?.enabled).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftRight' })); menu.dispose();
  });
});
