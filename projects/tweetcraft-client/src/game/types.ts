export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type Capability = 'position' | 'entities' | 'camera' | 'aim' | 'attack' | 'world' | 'flight' | 'movement-sync';
export type TargetType = 'player' | 'hostile' | 'animal';
export type Entity = Vec3 & Readonly<{
  id: number; name: string; type: TargetType; height: number; width: number; crouching: boolean; updatedAt: number;
}>;
export type Camera = Readonly<{
  position: Vec3; matrix: readonly number[]; yaw: number; pitch: number;
  width: number; height: number; updatedAt: number; firstPerson: boolean;
}>;
export type GameSnapshot = Readonly<{
  connected: boolean; synced: boolean; active: boolean; selfId: number | null;
  position: Vec3 | null; entities: readonly Entity[]; camera: Camera | null;
  capabilities: ReadonlySet<Capability>; issues: readonly string[];
  attackRequests: number; hitEvents: number; deniedHits: number;
  movement?: Readonly<{ rate: number; extraPackets: number; resets: number; lastResetDistance: number | null }>;
}>;
export type GameAdapter = Readonly<{
  snapshot(now: number): GameSnapshot;
  aim(yawDelta: number, pitchDelta: number): boolean;
  attack(): boolean;
  visible(from: Vec3, to: Vec3): boolean;
  flight(enabled: boolean): boolean;
  groundSpeed?(multiplier: number): boolean;
  syncPosition?(now: number): boolean;
  dispose(): void;
}>;
