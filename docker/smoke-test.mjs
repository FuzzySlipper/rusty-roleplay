import { stat } from "node:fs/promises";

const baseUrl = (
  process.env.RUSTY_ROLEPLAY_BASE_URL ?? "http://127.0.0.1:9347"
).replace(/\/+$/, "");
const sqlitePath =
  process.env.RUSTY_ROLEPLAY_SQLITE_PATH ??
  "/home/system/rusty-roleplay-test/data/engine/coordination.sqlite3";

const health = await api("/v1/admin/healthz");
if (health.ok !== true || health.health === "blocked") {
  throw new Error(`unexpected liveness: ${JSON.stringify(health)}`);
}

const storage = await api("/v1/admin/diagnostics/storage");
if (storage.backend !== "sqlite")
  throw new Error(`expected sqlite storage, observed ${storage.backend}`);

const profile = await api("/v1/admin/profiles/registry/roleplay-test");
if (profile.profileId !== "roleplay-test")
  throw new Error("roleplay-test profile was not readable");

const session = await api("/v1/admin/roleplay/sessions/roleplay-test-scene");
if (
  (session.session?.session_id ?? session.session?.sessionId) !==
  "roleplay-test-scene"
) {
  throw new Error("roleplay test session was not readable");
}

const lore = await api(
  "/v1/admin/roleplay/lore/entries/search?q=clockmaker&profile_id=roleplay-test&layer_id=roleplay-test-world&limit=20&offset=0",
);
if (!Array.isArray(lore.entries) || lore.entries.length === 0) {
  throw new Error("FTS5 lore roundtrip did not return the seeded entry");
}

const indexResponse = await fetch(`${baseUrl}/`);
const index = await indexResponse.text();
if (
  !indexResponse.ok ||
  !index.includes("<app-root") ||
  !index.includes("runtime-config.js")
) {
  throw new Error("roleplay frontend index was not served by Rusty Crew");
}
const runtimeConfigResponse = await fetch(`${baseUrl}/runtime-config.js`);
const runtimeConfig = await runtimeConfigResponse.text();
if (
  !runtimeConfigResponse.ok ||
  !runtimeConfig.includes("window.location.origin") ||
  !/coordinationRole:\s*["']debug["']/.test(runtimeConfig)
) {
  throw new Error(
    "container runtime config did not pin the API and debug coordination role",
  );
}

const database = await stat(sqlitePath);
if (!database.isFile() || database.size === 0)
  throw new Error(`SQLite database is empty: ${sqlitePath}`);

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      liveness: health.health,
      storageBackend: storage.backend,
      profileId: profile.profileId,
      roleplaySessionId: "roleplay-test-scene",
      ftsMatches: lore.entries.length,
      sqlitePath,
      sqliteBytes: database.size,
      staticFrontend: true,
      sameOriginApi: true,
    },
    null,
    2,
  ),
);

async function api(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) {
    throw new Error(
      `${path} returned ${response.status}: ${envelope?.error?.message ?? envelope?.error?.reason_code ?? JSON.stringify(envelope)}`,
    );
  }
  return envelope.data ?? {};
}
