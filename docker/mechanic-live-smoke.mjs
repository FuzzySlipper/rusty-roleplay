import assert from "node:assert/strict";

const baseUrl = (
  process.env.RUSTY_ROLEPLAY_BASE_URL ?? "http://127.0.0.1:9347"
).replace(/\/+$/, "");
const narratorProfileId = "roleplay-test";
const mechanicProfileId = "roleplay-mechanic-test";
const roleplaySessionId = "roleplay-test-scene";
const marker = `TASK5962_MECHANIC_${Date.now()}`;
const acceptedExemplar = `Rain counted three patient notes against the silver orchard gate. ${marker}`;
const rejectedExemplar = `This rejected exemplar must remain inert. ${marker}`;

const mechanicConfig = await apiData(
  "GET",
  `/v1/admin/roleplay/profiles/${mechanicProfileId}/mechanic-config`,
);
assert.equal(mechanicConfig.configured, true);
assert.equal(mechanicConfig.localToolProfileId, "roleplay_mechanic");
assert.equal(mechanicConfig.toolPolicyIsolated, true);

const mechanicSessions = await apiData(
  "GET",
  `/v1/admin/roleplay/mechanic-sessions?mechanic_profile_id=${mechanicProfileId}`,
);
const mechanicSession = mechanicSessions.items.find(
  (item) =>
    item.association.roleplaySessionId === roleplaySessionId &&
    item.session?.status !== "archived",
);
assert.ok(mechanicSession, "seeded attached mechanic session is required");
const mechanicSessionId = mechanicSession.association.mechanicSessionId;

const beforeConfig = await narratorConfig();
const proposalMarkdown = [
  "---",
  `roleplay_session_id: ${roleplaySessionId}`,
  "change_kind: exemplar",
  `rationale: ${marker}`,
  "evidence:",
  "  - attached-transcript-and-recall-trace",
  "---",
  acceptedExemplar,
].join("\n");
const diagnosticMarkdown = [
  "---",
  "symptom: Repeated crest explanations contradict one another.",
  "hypothesis: The constant lore states that the crest matches but leaves its origin unconstrained.",
  "---",
  `${marker}: grounded in the attached transcript and recall trace.`,
].join("\n");
const events = await sendAndWait(
  mechanicSessionId,
  [
    `This is live certification ${marker}.`,
    `Call inspect_roleplay_transcript for sessionId ${roleplaySessionId} with limit 8.`,
    `Call inspect_roleplay_scene for sessionId ${roleplaySessionId}.`,
    `Call inspect_lore_retrieval for sessionId ${roleplaySessionId} with limit 5.`,
    "Call propose_roleplay_change exactly once using this complete Markdown as its proposal argument:",
    proposalMarkdown,
    "Call record_roleplay_diagnostic exactly once using this complete Markdown as its report argument:",
    diagnosticMarkdown,
    "Do not directly mutate or apply anything. State that user approval is required.",
  ].join("\n\n"),
);
const completedTools = events
  .filter(
    (event) =>
      event.kind === "tool_call_completed" && event.payload?.is_error !== true,
  )
  .map((event) => String(event.payload?.tool_name ?? ""));
for (const tool of [
  "inspect_roleplay_transcript",
  "inspect_roleplay_scene",
  "inspect_lore_retrieval",
  "propose_roleplay_change",
  "record_roleplay_diagnostic",
]) {
  assert.ok(completedTools.includes(tool), `missing completed tool ${tool}`);
}

const proposals = await apiData(
  "GET",
  `/v1/admin/roleplay/mechanic-proposals?roleplay_session_id=${roleplaySessionId}`,
);
const proposed = proposals.find((proposal) => proposal.rationale === marker);
assert.ok(proposed, "model-created proposal was not persisted");
assert.equal(proposed.status, "proposed");
assert.equal(proposed.proposedValue, acceptedExemplar);
assert.equal((await narratorConfig()).exemplar, beforeConfig.exemplar);

const diagnostics = await apiData(
  "GET",
  `/v1/admin/roleplay/mechanic-diagnostics?mechanic_session_id=${encodeURIComponent(mechanicSessionId)}`,
);
const diagnostic = diagnostics.items.find((item) =>
  item.notes?.includes(marker),
);
assert.ok(diagnostic, "model-created diagnostic was not persisted");

const approved = await apiData(
  "POST",
  `/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(proposed.proposalId)}/approve`,
  {
    reviewerId: "task-5962-operator",
    note: "Isolated mechanic live certification approval.",
    expectedRevision: proposed.revision,
  },
);
assert.equal(approved.status, "approved");
assert.equal((await narratorConfig()).exemplar, beforeConfig.exemplar);

const applied = await apiData(
  "POST",
  `/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(proposed.proposalId)}/apply`,
  { actorId: "task-5962-operator" },
);
assert.equal(applied.proposal.status, "applied");
assert.equal((await narratorConfig()).exemplar, acceptedExemplar);
const reapplied = await apiData(
  "POST",
  `/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(proposed.proposalId)}/apply`,
  { actorId: "task-5962-operator" },
);
assert.equal(reapplied.proposal.revision, applied.proposal.revision);

const rejected = await apiData(
  "POST",
  "/v1/admin/roleplay/mechanic-proposals",
  {
    proposalId: `mechanic-proposal-rejected-${Date.now()}`,
    mechanicSessionId,
    roleplaySessionId,
    kind: "exemplar",
    proposedValue: rejectedExemplar,
    rationale: `Rejected ${marker}`,
    diagnosticContext: { source: "task-5962-live-certification" },
  },
);
const rejectedDecision = await apiData(
  "POST",
  `/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(rejected.proposalId)}/reject`,
  {
    reviewerId: "task-5962-operator",
    note: "Exercise the rejection boundary.",
    expectedRevision: rejected.revision,
  },
);
assert.equal(rejectedDecision.status, "rejected");
const rejectedApply = await api(
  "POST",
  `/v1/admin/roleplay/mechanic-proposals/${encodeURIComponent(rejected.proposalId)}/apply`,
  { actorId: "task-5962-operator" },
);
assert.equal(rejectedApply.status, 409, rejectedApply.text);
assert.equal((await narratorConfig()).exemplar, acceptedExemplar);

const outcome = await apiData(
  "POST",
  `/v1/admin/roleplay/mechanic-diagnostics/${encodeURIComponent(diagnostic.diagnosticId)}/outcome`,
  {
    outcome: "improved",
    notes: "Proposal application completed in isolated live certification.",
    expectedRevision: diagnostic.revision,
  },
);
assert.equal(outcome.diagnostic.outcome, "improved");

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      marker,
      narratorProfileId,
      mechanicProfileId,
      mechanicSessionId,
      roleplaySessionId,
      completedTools,
      proposalId: proposed.proposalId,
      diagnosticId: diagnostic.diagnosticId,
      proposalStayedInertUntilApply: true,
      appliedIdempotently: true,
      rejectionStayedInert: true,
      diagnosticOutcome: outcome.diagnostic.outcome,
    },
    null,
    2,
  ),
);

async function narratorConfig() {
  return (
    await apiData(
      "GET",
      `/v1/admin/roleplay/profiles/${narratorProfileId}/narrator-config`,
    )
  ).config;
}

async function sendAndWait(sessionId, body) {
  const before = await apiData("GET", `/v1/chat/sessions/${sessionId}`);
  let cursor = before.session?.latest_cursor ?? before.latest_cursor;
  const key = `task-5962:${sessionId}:${Date.now()}`;
  const sent = await api(
    "POST",
    `/v1/chat/sessions/${sessionId}/messages`,
    {
      actor: { id: "task-5962-operator", kind: "human" },
      body,
      client_message_id: key,
      reason: "task-5962 isolated mechanic live certification",
    },
    { "Idempotency-Key": key },
  );
  assert.equal(sent.status, 202, sent.text);
  const events = [];
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const page = await apiData(
      "GET",
      `/v1/chat/sessions/${sessionId}/events?cursor=${encodeURIComponent(cursor)}&limit=500`,
    );
    if (Array.isArray(page.items)) events.push(...page.items);
    cursor = page.latest_cursor ?? cursor;
    if (events.some((event) => event.kind === "assistant_turn_finished")) {
      const failure = events.find(
        (event) =>
          event.kind === "assistant_turn_finished" &&
          event.payload?.status === "failed",
      );
      assert.equal(failure, undefined, JSON.stringify(failure));
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for mechanic session ${sessionId}`);
}

async function apiData(method, path, body) {
  const response = await api(method, path, body);
  assert.ok(response.status < 400, response.text);
  assert.equal(response.json.ok, true, response.text);
  return response.json.data;
}

async function api(method, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    // Assertions retain raw response text.
  }
  return { status: response.status, text, json };
}
