import { InjectionToken } from '@angular/core';

/**
 * Runtime resolution of backend service URLs, so a single build works whether
 * the app is opened locally or from a remote workstation over LAN/Tailscale.
 *
 * Nothing here is hardcoded to a host. The previous failure mode (in rusty-view's
 * debug-chat) was a baked-in `http://127.0.0.1:9347`, which only worked when the
 * browser ran on the same machine as the backend; every remote user got an
 * unreachable loopback. roleplay-frontend is explicitly meant for remote viewing
 * (people viewing from a server), so it must resolve URLs at runtime.
 *
 * The transport / lorekeep clients (when wired) inject {@link BACKEND_CONFIG}.
 * Today the app renders mock data, so nothing consumes it yet — this is the
 * foundation those clients build on.
 */
export interface BackendConfig {
  /** rusty-crew chat API base, e.g. http://den-k8:9347 */
  readonly rustyCrewBaseUrl: string;
  /** lorekeep lore/memory API base, e.g. http://den-k8:8790 */
  readonly lorekeepBaseUrl: string;
  /** Optional bearer token (omit for no-auth trusted-LAN mode). */
  readonly bearerToken: string | undefined;
}

/** Default service ports, used when deriving a URL from the serving host. */
const DEFAULT_RUSTY_CREW_PORT = 9347;
const DEFAULT_LOREKEEP_PORT = 8790;

/**
 * Optional deploy-time config injected on `window` (e.g. via a `<script>` in
 * index.html or a config.js). Lets a deployment pin backend URLs without a
 * rebuild.
 */
export interface RustyRoleplayWindowConfig {
  readonly rustyCrewBaseUrl?: string;
  readonly lorekeepBaseUrl?: string;
  readonly bearerToken?: string;
}

declare global {
  interface Window {
    __RUSTY_ROLEPLAY_CONFIG__?: RustyRoleplayWindowConfig;
  }
}

/** The serving-origin fields the resolver needs (a subset of `Location`). */
export type ServingOrigin = Pick<Location, 'protocol' | 'hostname' | 'search'>;

/**
 * Resolve a backend config from explicit inputs. Resolution order, per URL
 * (first match wins):
 *
 *   1. `?api=<url>` / `?lore=<url>` query param — explicit, ephemeral.
 *   2. `window.__RUSTY_ROLEPLAY_CONFIG__` — injected at deploy time.
 *   3. The serving host, on the default port — the view loaded from
 *      `http://den-k8:4200` talks to `http://den-k8:9347` (chat) and
 *      `http://den-k8:8790` (lorekeep).
 */
export function resolveBackendConfigFrom(
  origin: ServingOrigin,
  windowConfig: RustyRoleplayWindowConfig | undefined,
): BackendConfig {
  const params = new URLSearchParams(origin.search);

  const derive = (port: number): string =>
    `${origin.protocol}//${origin.hostname}:${port}`;

  const pick = (
    queryKey: string,
    configValue: string | undefined,
    port: number,
  ): string => {
    const fromQuery = params.get(queryKey)?.trim();
    const queryValue = fromQuery ? fromQuery : undefined;
    return queryValue ?? configValue ?? derive(port);
  };

  return {
    rustyCrewBaseUrl: pick(
      'api',
      windowConfig?.rustyCrewBaseUrl,
      DEFAULT_RUSTY_CREW_PORT,
    ),
    lorekeepBaseUrl: pick(
      'lore',
      windowConfig?.lorekeepBaseUrl,
      DEFAULT_LOREKEEP_PORT,
    ),
    bearerToken: windowConfig?.bearerToken,
  };
}

/** Resolve the backend config from the live browser environment. */
export function resolveBackendConfig(): BackendConfig {
  return resolveBackendConfigFrom(
    window.location,
    window.__RUSTY_ROLEPLAY_CONFIG__,
  );
}

/**
 * DI token for the resolved backend config. Provided application-wide; transport
 * and lorekeep clients inject this rather than constructing URLs themselves.
 */
export const BACKEND_CONFIG = new InjectionToken<BackendConfig>(
  'BACKEND_CONFIG',
  { providedIn: 'root', factory: resolveBackendConfig },
);
