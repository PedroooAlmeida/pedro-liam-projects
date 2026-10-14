# Tweetcraft Client

A modular Manifest V3 Chrome extension for Tweetcraft. The project is self-contained inside this monorepo: run its commands from this directory. There is no nested Git repository.

## Install for development

Use Node.js 24 and npm 11 or newer.

```sh
cd projects/tweetcraft-client
npm ci
npm run check
```

1. In Chrome, open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project's **`dist` folder**:

   `/Users/liamlincolnhol/LiamPedro Projects/projects/tweetcraft-client/dist`

4. Open the [Tweetcraft world](https://tweetcraft.jai.vin/r/ti9bwes4ryguhkra).
5. Refresh the game if it was already open. Startup hooks need to run before the engine loads.
6. Press **Right Shift** or click **TC / Right Shift** to open the client menu.

The extension matches Tweetcraft's `/r/` and `/play/` pages, including matching embedded frames. Start with the direct site while testing.

After changes, run `npm run build` (or leave `npm run dev` running), reload the extension on Chrome's Extensions page, then refresh Tweetcraft. Watch mode rebuilds source files; changes to `manifest.json` require restarting the build command.

## Initial modules

| Module | Behavior | Default |
| --- | --- | --- |
| Coordinates | Reads player position from WASM memory | On |
| Diagnostics | Shows engine/camera/network health and observed combat traffic | On |
| Player ESP | Boxes, distance labels, optional tracers for received player positions | Off |
| Target HUD | Shared target selection and angular FOV guide | On |
| Aim Assist | Turns toward the selected visible target through game mouse controls | Off |
| Trigger Bot | Clicks through game controls for aligned targets within range | Off |
| Flight | Uses the native flight physics with WASD, Space up, Left Shift down | Off |
| Ground Speed | Runs additional native movement steps on solid ground, suppressing jumping | Off |
| Movement Sync | Supplements movement updates at 50ms spacing while moving | Off |

Target HUD's range, FOV, and target-type settings control the shared target-selection service even when the HUD itself is disabled. Players, hostile mobs, and animals can be selected independently. Mob positions, dimensions (including babies), movement, death, and despawn are tracked from the entity protocol; dropped items, XP, and projectiles are excluded. Player ESP continues to highlight players only.

Combat and Flight require a fresh first-person camera, a synchronized connection, and focused gameplay. Direct pages use pointer lock; inside Twitter/X, click the game canvas to focus its native drag controls. Embedded aiming establishes a short auxiliary drag when needed and uses the game's drag sensitivity, without clicking attack/place buttons or interrupting a held drag. They suspend while the client menu, native pause/loading screens, chat, or inventory is open or the tab loses focus. Close the client menu and click back into the game to continue. Flight is under the **Movement** tab and uses the game's native WASD/Space/Left Shift controls. It restores the previous flight state when disabled. Local flight has been verified against the fetched game engine; server-accepted movement still needs a live test.

Assign module hotkeys in the menu. Hotkeys do not fire while typing. **Disable all** switches off every module, including overlays. Preferences persist using `chrome.storage.local`.

For ground movement, turn **Flight off**, enable **Ground Speed** under Movement, and start with the default 1.5 multiplier. The boost uses native collision handling, stops at walls, and suspends when airborne, flying, or in liquids. Jump input is suppressed while boosting on solid ground; walking off a ledge still falls normally. Local tests against the fetched engine confirm roughly double ground travel at multiplier 2 with stable height and normal wall/ledge collisions. Server acceptance remains unverified.

**Movement Sync** is a separate optional experiment for crowded-world position-update gaps. It fills gaps with current position/look data, observes a 50ms interval since the last sent update, and stops on menus, lost focus, stale native traffic, disconnects, or server resets. It never repeats swing flags or asserts creative-flight permission. Diagnostics shows outgoing movement packets per second, supplemental packet count, and server position resets with displacement. A reset can also be a respawn or dimension change; these counts do not prove an anti-cheat cause. Faster updates cannot be assumed to bypass server collision or speed checks.

Client readouts use a compact right-side stack below the game controls and avoid visible native HUD elements. The launcher moves below the native top-right buttons. Game menus hide the client overlays. Readouts avoid the bottom 180 pixels reserved for health, food, and the hotbar; world-space ESP lines and the FOV circle use the full viewport and draw behind the native game HUD without a hard cutoff.

## Verification and limits

`npm run check` runs strict type checking, tests with an 80% coverage gate across executable extension source, and the production build. Core lifecycle, targeting, settings, and action coordination have dedicated behavioral tests. `npm audit` checks development dependencies.

```sh
npm run preview
```

This serves an authored integration harness at [127.0.0.1:2819](http://127.0.0.1:2819). It runs the actual extension bundles against a small WASM fixture, real WebGL uniforms, simulated protocol messages, and simulated game controls. The harness is **not shipped in `dist`**, does not contact Tweetcraft, and does not establish live-server compatibility.

The installed client has been observed on the live Tweetcraft world: its menu responds and reports position, world, entity-protocol, and camera capabilities connected. This verifies startup integration; it does not establish moving-player ESP alignment, aim behavior, or server-accepted combat outcomes. Those checks remain required with a nearby test player.

The adapter targets the observed protocol version **5**, engine export signatures, and terrain shader uniforms. Unsupported protocols leave tracking/action modules unavailable. A game update may require adapter changes.

Player ESP uses received network positions; it may lead the game's interpolated models during movement. The line-of-sight check conservatively treats solid, leaf, and glass blocks as obstacles, including partial block shapes. Server hurt events are general observations, **not proof that a particular automated attack caused damage**. Inspect a second player's health to verify actual outcomes. No server-accepted combat behavior has been established by the local harness.

Invulnerability is not implemented. The inspected client receives creative-mode permission and health updates from the server; changing local health or hiding damage would not establish actual immunity. Block X-ray is also not part of this version; enabled Player ESP draws player boxes/labels through terrain using data already received by the game.

No-inventory golden-apple consumption is also unverified. Eating sends start/finish requests without an item ID or requested health value; the client selects the held inventory slot. Local prediction adjusts food/saturation, not health. A cosmetic apple or local health edit would not verify server healing.

## First live test

1. Leave Aim Assist and Trigger Bot off initially.
2. Join a world and confirm that coordinates track movement and Diagnostics reports engine, camera, and connection readiness.
3. With a friend in the same world, enable Player ESP. Check labels and boxes while both players move and turn.
4. Open/close the menu, type in chat, open inventory, switch tabs, and reconnect. Confirm input and module cleanup remain correct.
5. Enable Aim Assist with a nearby visible target. Verify the camera turns toward them and stops when gameplay loses focus.
6. Enable Trigger Bot at close range. Compare attack requests and server events with the other player's actual health. Test looking away and placing a wall between players.

Chrome automation cannot access the Extensions management page in this environment; loading the unpacked folder requires a manual step.

## Adding a module

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, lifecycle, and extension points.
