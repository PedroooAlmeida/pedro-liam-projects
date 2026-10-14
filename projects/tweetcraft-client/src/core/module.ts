import type { Capability, GameSnapshot } from '../game/types';
import type { Setting, Values } from './settings';
import type { Target } from '../services/targeting';
import type { ActionCoordinator } from '../services/actions';
import type { HudLayout } from '../services/hud-layout';

export type ModuleContext = Readonly<{
  game: GameSnapshot; now: number; dt: number; settings: Values;
  target: Target | null; actions: ActionCoordinator; signal: AbortSignal;
  hud: HudLayout;
  visible: (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) => boolean;
}>;
export type ModuleDefinition = Readonly<{
  id: string; name: string; description: string; category: 'Combat' | 'Render' | 'Client' | 'Movement';
  requires: readonly Capability[]; settings: Readonly<Record<string, Setting>>; defaultEnabled?: boolean;
  create(): {
    enable?(context: ModuleContext): void;
    disable?(): void;
    update?(context: ModuleContext): void;
    render?(context: ModuleContext, canvas: CanvasRenderingContext2D): void;
  };
}>;
export type ModuleStatus = Readonly<{
  id: string; name: string; description: string; category: string;
  enabled: boolean; running: boolean; reason: string; keybind: string;
  settings: Readonly<Record<string, Setting>>; values: Values;
}>;
