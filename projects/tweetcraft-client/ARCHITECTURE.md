# Architecture

## Boundaries

```text
Tweetcraft WASM / WebSocket / WebGL
                ↓
          game adapter
                ↓
      module runtime and services
                ↕
       validated message bridge
                ↕
     isolated menu and persistence
```

- `entrypoints/main.ts` runs in Chrome's MAIN world at document start. It owns adapter hooks, module execution, actions, and the shared overlay.
- `entrypoints/content.ts` runs in an isolated world. It owns the Shadow DOM menu and Chrome storage.
- `bridge/` contains versioned, validated commands and status messages. No arbitrary evaluation, arbitrary network requests, or access to credentials crosses this interface. The page can observe/spoof page-world messages; the bridge is a transport, not an authentication boundary.
- `game/` is the only code that understands Tweetcraft exports, uniforms, and packet layouts. Modules never access raw WASM memory or sockets.
- `core/` owns normalized settings and module lifecycle.
- `services/` owns shared targeting, action arbitration, and overlay rendering.
- `modules/<id>/module.ts` declares each feature. Registration is explicit in `modules/registry.ts`.

The extension has only the `storage` API permission and site-specific content-script matches. No backend, background service worker, externally downloaded extension code, game source replacement, or third-party game assets are required. All extension code is bundled locally.

## Game integration

The engine hook transparently observes `WebAssembly.instantiate` and `instantiateStreaming`. It recognizes `memory`, `state_ptr`, `kind_ptr`, and `get_block`, then reads fresh memory views so growth cannot leave a detached buffer cached.

The network hook observes only matching same-host game sockets. It keeps player metadata and positions, handles incremental/full relay frames, and clears state on disconnect. Stationary players remain tracked: full snapshots and leave messages determine presence, rather than a timeout since the last movement update. It recognizes protocol 5 through the game's outgoing hello. It does not retain the hello's tokens, session IDs, chat, or account data.

The renderer hook observes terrain `uVP` and `uOrigin` uniforms only on the game's `#gl` WebGL2 canvas. Terrain origin is chunk origin minus camera position; local player position resolves the nearby chunk. The resulting matrix and interpolated camera drive projection. Camera freshness and first-person checks gate actions. This assumes camera/player separation under half a chunk and the current terrain uniform layout.

Actions use synthetic mouse events through Tweetcraft's existing controls, preserving its own targeting and server communication. This is an integration hypothesis that must be validated live. The adapter does not assert server acceptance from dispatch success.

Every hook preserves native return values, failures, and receivers. Cleanup restores a hook only if our wrapper is still installed, preserving hooks added later by other code.

## Module contract

Each definition supplies metadata, capability requirements, settings schema, and an instance factory. Instances may implement `enable`, `disable`, `update`, and `render`.

```ts
export const module: ModuleDefinition = {
  id: 'example',
  name: 'Example',
  description: 'Describe the behavior.',
  category: 'Render',
  requires: ['position'],
  settings: {},
  create: () => ({
    render({ game }, canvas) {
      // Draw using the adapter snapshot and shared canvas.
    },
  }),
};
```

Add the module to `registry.ts` and add behavioral tests. The menu derives toggles and setting controls from the definition. Stable IDs are persisted, so renaming an ID requires a profile migration.

The runtime separates requested enablement from actual running status. Missing capabilities stop a module and show a reason; restoration starts it again. An exception isolates that module until it is toggled off/on. Cleanup failures are reported. A scope's `AbortSignal` cancels event subscriptions on stop; custom resources must be released in `disable`.

## Execution and state

One animation loop snapshots the adapter, computes a shared target, updates modules, renders the shared canvas, and flushes permitted actions. Delta time is clamped after stalls. UI status is throttled to four updates per second; world snapshots remain in the game world rather than crossing the bridge every frame.

Action requests include module ID and priority. One aim and one attack request win per frame; equal priorities use module ID as a stable tie-breaker. Attack cooldowns are shared, failed control dispatches can retry, and module failures cancel their pending requests. Input readiness is checked again at dispatch.

The isolated menu owns persisted preferences; the MAIN runtime owns live running/fault state. The startup handshake applies the saved profile after both contexts are listening. Unknown settings are removed, numeric values are bounded, and messages use explicit command types.

## Validation

Tests cover the real WASM interception overloads and memory growth, protocol frames and malformed input, camera reconstruction, reconnect isolation, setting normalization, action arbitration, lifecycle fault recovery, module behavior, menu interactions, and entrypoint handshake/cleanup. A loopback-only harness tests the actual bundles in Chrome without installing an extension.

Live checks are documented in README.md. Source-signature compatibility, game-specific mouse behavior, moving-player alignment, and server-accepted combat outcomes require the actual game; fixture success cannot prove them.

## Revisit as the project grows

- Add settings migrations before changing the profile format or module IDs.
- Measure before adding workers, caches, or spatial indexes for large worlds.
- Match Tweetcraft's interpolation if moving-player ESP alignment needs improvement.
- Split specialized modules into additional shared services only when reuse exists.
- Introduce monorepo workspaces/shared packages when another project needs them.
