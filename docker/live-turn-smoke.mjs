import { randomUUID } from "node:crypto";

const baseUrl = (
  process.env.RUSTY_ROLEPLAY_BASE_URL ?? "http://127.0.0.1:9347"
).replace(/\/+$/, "");
const sessionId = "roleplay-test-scene";
const deadline = Date.now() + 180_000;

const before = await api("GET", `/v1/chat/sessions/${sessionId}`);
let cursor = before.session?.latest_cursor ?? before.latest_cursor;

await api("POST", `/v1/chat/sessions/${sessionId}/messages`, {
  actor: { id: "rowan", kind: "human", display_name: "Rowan" },
  body: "I hold up the obsidian locket beneath the silver orchard. Elara, why does its serpent-and-rose crest match the gate?",
  client_message_id: `container-smoke-${randomUUID()}`,
});

const events = [];
let terminal;
while (Date.now() < deadline && terminal === undefined) {
  const params = new URLSearchParams({ limit: "1000" });
  if (cursor) params.set("cursor", cursor);
  const page = await api(
    "GET",
    `/v1/chat/sessions/${sessionId}/events?${params}`,
  );
  const items = Array.isArray(page.items) ? page.items : [];
  events.push(...items);
  cursor = page.latest_cursor ?? cursor;
  terminal = items.find(
    (event) =>
      event.kind === "assistant_turn_finished" || event.kind === "stream_error",
  );
  if (terminal === undefined)
    await new Promise((resolve) => setTimeout(resolve, 500));
}

if (terminal === undefined)
  throw new Error("timed out waiting for the roleplay narrator turn");
if (terminal.kind === "stream_error" || terminal.payload?.status === "failed") {
  throw new Error(`roleplay narrator turn failed: ${JSON.stringify(terminal)}`);
}

const text = events
  .filter((event) => event.kind === "assistant_text_delta")
  .map((event) => String(event.payload?.text ?? ""))
  .join("");
if (text.trim().length < 20)
  throw new Error(`roleplay narrator returned only ${text.length} characters`);

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      sessionId,
      responseCharacters: text.length,
      phases: events
        .filter((event) => event.kind === "phase_change")
        .map((event) => event.payload?.phase),
      tools: events
        .filter((event) => event.kind === "tool_call_started")
        .map((event) => event.payload?.tool_name),
      preview: text.slice(0, 240),
    },
    null,
    2,
  ),
);

async function api(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${envelope?.error?.message ?? envelope?.error?.reason_code ?? JSON.stringify(envelope)}`,
    );
  }
  return envelope.data ?? {};
}
