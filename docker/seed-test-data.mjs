const baseUrl = (
  process.env.RUSTY_ROLEPLAY_BASE_URL ?? "http://127.0.0.1:9347"
).replace(/\/+$/, "");
const profileId = "roleplay-test";
const mechanicProfileId = "roleplay-mechanic-test";
const providerAlias = "roleplay-test-router";
const providerBaseUrl = (
  process.env.RUSTY_ROLEPLAY_PROVIDER_BASE_URL ??
  "http://host.docker.internal:18082/v1"
).replace(/\/+$/, "");
const roleplaySessionId = "roleplay-test-scene";
const layerId = "roleplay-test-world";
const characterId = "elara-voss";
const personaId = "rowan";
const loreRecordId = "silver-orchard-gate";
const providerWrite = {
  alias: providerAlias,
  status: "active",
  protocol: "chat_completions",
  providerKind: "den-router",
  displayName: "Roleplay Test Router",
  description: "No-secret roleplay test provider through the host den-router.",
  baseUrl: providerBaseUrl,
  modelId: "deepseek-flash",
  contextWindowTokens: 128000,
  maxOutputTokens: 2048,
  temperature: 0.2,
  metadataJson: {
    purpose: "rusty_roleplay_container_test",
    credential_owner: "den-router",
  },
};

await waitForHealth();

const existingProvider = await optional(
  `/v1/admin/model-providers/${providerAlias}`,
);
if (existingProvider === undefined) {
  await api("POST", "/v1/admin/model-providers", providerWrite);
} else if (existingProvider.baseUrl !== providerBaseUrl) {
  await api(
    "PATCH",
    `/v1/admin/model-providers/${providerAlias}?refresh=apply`,
    {
      ...providerWrite,
      expectedRevision: existingProvider.revision,
    },
  );
}

if (!(await exists(`/v1/admin/profiles/registry/${profileId}`))) {
  await api("POST", "/v1/admin/control/profiles", {
    profileId,
    displayName: "Roleplay Test",
    kind: "full",
    providerAlias,
    brain: { module: "chat-completions", strategy: "roleplay_narrator" },
    localToolProfileId: "roleplay_lore",
    reason: "isolated Docker roleplay test fixture",
  });
}

if (!(await exists(`/v1/admin/profiles/registry/${mechanicProfileId}`))) {
  await api("POST", "/v1/admin/control/profiles", {
    profileId: mechanicProfileId,
    displayName: "Roleplay Mechanic Test",
    kind: "full",
    providerAlias,
    localToolProfileId: "basic_chat",
    reason: "isolated Docker roleplay mechanic test fixture",
  });
}

const mechanicConfig = await api(
  "GET",
  `/v1/admin/roleplay/profiles/${mechanicProfileId}/mechanic-config`,
);
if (
  mechanicConfig.configured !== true ||
  mechanicConfig.toolPolicyIsolated !== true ||
  mechanicConfig.config?.name !== "Maren" ||
  mechanicConfig.config?.providerAlias !== providerAlias
) {
  await api(
    "PATCH",
    `/v1/admin/roleplay/profiles/${mechanicProfileId}/mechanic-config`,
    {
      name: "Maren",
      providerAlias,
      autoMonitor: false,
    },
  );
}

const layers = await api(
  "GET",
  `/v1/admin/roleplay/lore/layers?profile_id=${profileId}`,
);
if (
  !array(layers.layers).some(
    (layer) => layer.layer_id === layerId || layer.layerId === layerId,
  )
) {
  await api("POST", "/v1/admin/roleplay/lore/layers", {
    layer_id: layerId,
    profile_id: profileId,
    name: "Silver Orchard",
    description: "Isolated test lore for the container deployment.",
    purpose: "world",
    write_policy: "manual",
  });
}

const characters = await api(
  "GET",
  `/v1/admin/roleplay/profiles/${profileId}/characters`,
);
if (
  !array(characters.items).some((character) => character.id === characterId)
) {
  await api("POST", `/v1/admin/roleplay/profiles/${profileId}/characters`, {
    id: characterId,
    name: "Elara Voss",
    description: "A guarded clockmaker with an obsidian locket.",
    personality: "observant, dryly funny, and slow to trust",
    scenario: "{{char}} meets {{user}} beneath the silver orchard.",
    firstMessage: "You heard the song too, then.",
    alternateGreetings: ["The orchard remembers you."],
    exampleMessages: ["Keep your voice down. The silver leaves listen."],
    tags: ["container-test", "clockmaker"],
  });
}

const personas = await api(
  "GET",
  `/v1/admin/roleplay/profiles/${profileId}/personas`,
);
if (!array(personas.items).some((persona) => persona.id === personaId)) {
  await api("POST", `/v1/admin/roleplay/profiles/${profileId}/personas`, {
    id: personaId,
    displayName: "Rowan",
    description: "A patient investigator who notices small physical details.",
    notes: "Uses first person and asks direct questions.",
  });
}

await api("PATCH", `/v1/admin/roleplay/profiles/${profileId}/narrator-config`, {
  tone: "wry",
  pacing: "balanced",
  explicitness: "implied",
  memoryDepth: "deep",
  stylePrompt:
    "Write clean in-world prose with concrete sensory detail and no technical narration.",
  exemplar: "The three notes faded; the silver leaves kept trembling.",
  review: { enabled: true, maxReviewCycles: 1 },
});

if (!(await exists(`/v1/admin/roleplay/sessions/${roleplaySessionId}`))) {
  await api("POST", "/v1/admin/roleplay/sessions", {
    sessionId: roleplaySessionId,
    profileId,
    displayName: "The Silver Orchard",
    playerPersonaId: personaId,
    characterId,
    activeLayerIds: [layerId],
  });
}

const mechanicSessions = await api(
  "GET",
  `/v1/admin/roleplay/mechanic-sessions?mechanic_profile_id=${mechanicProfileId}`,
);
const mechanicSession = array(mechanicSessions.items).find(
  (item) =>
    item?.association?.roleplaySessionId === roleplaySessionId &&
    item?.session?.status !== "archived",
);
const mechanicSessionId =
  mechanicSession?.association?.mechanicSessionId ??
  (
    await api("POST", "/v1/admin/roleplay/mechanic-sessions", {
      profileId: mechanicProfileId,
      roleplaySessionId,
    })
  ).association.mechanicSessionId;

const search = await api(
  "GET",
  `/v1/admin/roleplay/lore/entries/search?q=clockmaker&profile_id=${profileId}&layer_id=${layerId}&limit=20&offset=0`,
);
if (!array(search.entries).some((entry) => recordId(entry) === loreRecordId)) {
  const now = new Date().toISOString();
  await api("POST", "/v1/admin/roleplay/lore/entries", {
    layer_id: layerId,
    write: {
      record_id: loreRecordId,
      world_id: profileId,
      entity_id: characterId,
      session_id: roleplaySessionId,
      shape: { shape_id: "lore_entry", version: 1 },
      canon_status: "canon",
      visibility: "public",
      title: "The Silver Orchard Gate",
      body: "The silver orchard gate opens to a three-note clockmaker song. Its serpent-and-rose crest matches Elara's obsidian locket.",
      content: {
        world_id: profileId,
        entity_id: characterId,
        title: "The Silver Orchard Gate",
        body: "The silver orchard gate opens to a three-note clockmaker song. Its serpent-and-rose crest matches Elara's obsidian locket.",
        canon_status: "canon",
        visibility: "public",
        metadata_json: {
          tags: ["silver-orchard", "clockmaker", "container-test"],
        },
      },
      evidence_refs: [
        {
          evidence_type: "other",
          ref_id: "task-3439",
          label: "container deployment fixture",
        },
      ],
      source: "import",
      confidence: 1,
      durability_rationale:
        "Stable fixture for isolated roleplay deployment tests.",
      now,
    },
    is_constant: true,
    priority: 10,
    capture_reason: "task-3439-container-fixture",
  });
}

console.log(
  JSON.stringify(
    {
      seeded: true,
      baseUrl,
      providerAlias,
      providerBaseUrl,
      profileId,
      mechanicProfileId,
      mechanicSessionId,
      runtimeSessionId: `${profileId}-session`,
      roleplaySessionId,
      layerId,
      characterId,
      personaId,
      loreRecordId,
    },
    null,
    2,
  ),
);

async function waitForHealth() {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/v1/admin/healthz`);
      if (response.ok) return;
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw lastError ?? new Error("timed out waiting for Rusty Crew health");
}

async function exists(path) {
  return (await optional(path)) !== undefined;
}

async function optional(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status === 404) return undefined;
  const envelope = await response.json();
  if (!response.ok || !envelope.ok)
    throw apiError(path, response.status, envelope);
  return envelope.data ?? {};
}

async function api(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = await response.json();
  if (!response.ok || !envelope.ok)
    throw apiError(path, response.status, envelope);
  const outcome = envelope.data?.outcome;
  if (outcome?.status === "failed") {
    throw new Error(
      `${method} ${path} failed: ${outcome.summary ?? "unknown outcome"}`,
    );
  }
  return envelope.data ?? {};
}

function apiError(path, status, envelope) {
  return new Error(
    `${path} returned ${status}: ${envelope?.error?.message ?? envelope?.error?.reason_code ?? JSON.stringify(envelope)}`,
  );
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function recordId(entry) {
  return (
    entry?.record_id ??
    entry?.recordId ??
    entry?.record?.record_id ??
    entry?.record?.recordId
  );
}
