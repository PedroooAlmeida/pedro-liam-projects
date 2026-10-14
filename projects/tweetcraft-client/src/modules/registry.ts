import type { ModuleDefinition } from '../core/module';
import { module as m0 } from './coordinates/module';
import { module as m1 } from './diagnostics/module';
import { module as m2 } from './player-esp/module';
import { module as m3 } from './target-hud/module';
import { module as m4 } from './aim-assist/module';
import { module as m5 } from './trigger-bot/module';

export const definitions: readonly ModuleDefinition[] = [m0, m1, m2, m3, m4, m5];
