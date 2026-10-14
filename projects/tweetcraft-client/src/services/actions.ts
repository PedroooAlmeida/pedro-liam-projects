export type ActionCoordinator = ReturnType<typeof createActions>;
type AimRequest = Readonly<{ owner: string; priority: number; yaw: number; pitch: number }>;
type AttackRequest = Readonly<{ owner: string; priority: number; interval: number }>;

export function createActions(driver: { aim(yaw: number, pitch: number): boolean; attack(): boolean; flight?(enabled: boolean): boolean }) {
  let aim: AimRequest | null = null;
  let attack: AttackRequest | null = null;
  let lastAttack = -Infinity;
  let flight: { owner: string; priority: number } | null = null;
  const choose = <T extends { owner: string; priority: number }>(a: T | null, b: T): T =>
    !a || b.priority > a.priority || b.priority === a.priority && b.owner < a.owner ? b : a;
  return {
    begin() { aim = null; attack = null; flight = null; },
    flight(request: { owner: string; priority: number }) {
      if (Number.isFinite(request.priority)) flight = choose(flight, request);
    },
    aim(request: AimRequest) {
      if ([request.yaw, request.pitch, request.priority].every(Number.isFinite)) aim = choose(aim, request);
    },
    attack(request: AttackRequest) {
      if (Number.isFinite(request.interval) && request.interval >= 100 && Number.isFinite(request.priority)) attack = choose(attack, request);
    },
    flush(active: boolean, now: number) {
      driver.flight?.(active && flight !== null);
      if (active && aim) driver.aim(aim.yaw, aim.pitch);
      if (active && attack && now - lastAttack >= attack.interval && driver.attack()) lastAttack = now;
      aim = null; attack = null; flight = null;
    },
    cancel(owner: string) {
      if (aim?.owner === owner) aim = null;
      if (attack?.owner === owner) attack = null;
      if (flight?.owner === owner) flight = null;
    },
    dispose() { aim = null; attack = null; flight = null; driver.flight?.(false); },
  };
}
