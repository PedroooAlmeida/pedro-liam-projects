// Restore only our own wrapper, preserving hooks installed by other code later.
export function observeMethod<T extends object, K extends keyof T>(target: T, key: K,
  after: (receiver: unknown, args: unknown[], result: unknown) => void, report: (error: unknown) => void): () => void {
  const original = target[key];
  if (typeof original !== 'function') throw new Error(`Missing method ${String(key)}`);
  const wrapper = new Proxy(original, {
    apply(fn, receiver, args) {
      const result: unknown = Reflect.apply(fn, receiver, args);
      try { after(receiver, args, result); } catch (error) { report(error); }
      return result;
    },
  });
  target[key] = wrapper;
  return () => { if (target[key] === wrapper) target[key] = original; };
}
