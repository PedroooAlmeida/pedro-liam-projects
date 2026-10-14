import type { ModuleContext, ModuleDefinition, ModuleStatus } from './module';
import { emptyProfile, settingsValues, type Preferences, type Profile } from './settings';

export function createRuntime(definitions: readonly ModuleDefinition[]) {
  const ids = new Set<string>();
  const entries = definitions.map(definition => {
    if (ids.has(definition.id)) throw new Error(`Duplicate module: ${definition.id}`);
    ids.add(definition.id);
    return { definition, instance: definition.create(), controller: new AbortController(), running: false, reason: '', fault: '',
      preferences: { enabled: definition.defaultEnabled ?? false, keybind: '', values: settingsValues(definition.settings, {}) } as Preferences };
  });
  const stop = (entry: typeof entries[number]) => {
    if (!entry.running) return;
    entry.running = false;
    entry.controller.abort();
    try { entry.instance.disable?.(); }
    catch (error) { entry.fault = `Cleanup failed: ${String(error)}`; }
  };
  const context = (entry: typeof entries[number], base: Omit<ModuleContext, 'settings' | 'signal'>): ModuleContext =>
    ({ ...base, settings: entry.preferences.values, signal: entry.controller.signal });
  return {
    apply(profile: Profile) {
      for (const entry of entries) {
        const preference = profile.modules[entry.definition.id];
        if (!preference) continue;
        if (preference.enabled !== entry.preferences.enabled) entry.fault = '';
        entry.preferences = { ...preference, values: settingsValues(entry.definition.settings, preference.values) };
        if (!preference.enabled) stop(entry);
      }
    },
    profile(): Profile {
      return { ...emptyProfile(), modules: Object.fromEntries(entries.map(e => [e.definition.id, e.preferences])) };
    },
    tick(base: Omit<ModuleContext, 'settings' | 'signal'>) {
      for (const entry of entries) {
        const missing = entry.definition.requires.filter(capability => !base.game.capabilities.has(capability));
        entry.reason = entry.fault || (missing.length ? `Waiting for ${missing.join(', ')}` : '');
        if (!entry.preferences.enabled || entry.reason) { stop(entry); continue; }
        try {
          if (!entry.running) {
            entry.controller = new AbortController();
            entry.running = true;
            entry.instance.enable?.(context(entry, base));
          }
          entry.instance.update?.(context(entry, base));
        } catch (error) {
          entry.fault = String(error); entry.reason = entry.fault;
          base.actions.cancel(entry.definition.id); stop(entry);
        }
      }
    },
    render(base: Omit<ModuleContext, 'settings' | 'signal'>, canvas: CanvasRenderingContext2D) {
      for (const entry of entries) {
        if (!entry.running || !entry.instance.render) continue;
        canvas.save();
        try { entry.instance.render(context(entry, base), canvas); }
        catch (error) { entry.fault = String(error); entry.reason = entry.fault; base.actions.cancel(entry.definition.id); stop(entry); }
        finally { canvas.restore(); }
      }
    },
    statuses(): readonly ModuleStatus[] {
      return entries.map(e => ({ id: e.definition.id, name: e.definition.name, description: e.definition.description,
        category: e.definition.category, enabled: e.preferences.enabled, running: e.running, reason: e.reason,
        keybind: e.preferences.keybind, settings: e.definition.settings, values: e.preferences.values }));
    },
    dispose() { entries.forEach(stop); },
  };
}
