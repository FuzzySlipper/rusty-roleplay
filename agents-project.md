# Rusty Roleplay Local Bootstrap

Project-specific live guidance and task management live in Den project
`rusty-roleplay`.

Use project ID `rusty-roleplay` for Den tasks, messages, documents,
librarian queries, and guidance lookups related to this repository.

## Source-of-truth posture

This local file is bootstrap context for agents entering the repository. It is
not the current planning queue.

- **Den** owns current task state, implementation queues, durable planning
  docs, and known limitations.
- **Repo docs** (`/home/dev/rusty-roleplay/docs/`) describe architecture and
  committed implementation surfaces.
- **The code/tests** are the implementation truth when they conflict with old
  planning prose.

## Architecture Soul

> A Go lore/memory service and an Angular RP chat frontend, sharing a
> monorepo. Roleplay-aware by design, consuming roleplay-agnostic chat
> client kit from the separate `rusty-view` repo.

- **lorekeep** (Go) follows den-memory's architectural patterns: FTS5, topic
  graph, scoped recall, contract-first design. Two deployment modes: ad-hoc
  during dev, Docker container for release (contains mechanic agent's broad
  tool surface).
- **roleplay-frontend** (Angular, not yet scaffolded) consumes `rusty-view`
  packages as versioned dependencies. rusty-view owns the boring chat
  mechanics (transport, transcript rendering, virtualized scroll). This repo
  adds RP-specific UI: character menus, lorebook browser, scene config,
  message decorators.
- **Library boundaries are load-bearing.** Go code follows Handler→Service→Store
  layering with constructor injection. Frontend code follows the rusty-view
  boundary model with extension tokens for RP-specific decoration.
- **Angular Signals, not global stores.** State is local and signal-based.
  No NgRx global store unless explicitly approved.
- **Config is never hardcoded.** Every tunable value lives in a typed config
  file. Go uses typed `Config` structs loaded from YAML. Frontend uses typed
  config objects. No scattered env vars for tunables — env vars are for
  secrets and config file paths only.

See `docs/` for the full system design documents (00-06 + rusty-view.md).

## Repository Structure

```
rusty-roleplay/
  agents-project.md          # this file — agent bootstrap + codestyle
  AGENTS.md                  # agent policy (from rusty-view template)
  README.md
  docs/                      # system design docs (00-06 + rusty-view.md)
  lorekeep/                  # Go lore/memory service
    cmd/
      lorekeep/              # main binary
      lorekeep-validate/     # contract validation
      lorekeep-migrate-st/   # ST lore book migration
    internal/
      store/                 # SQLite + FTS5
      recall/                # scoring, budgeting, packet assembly
      httpapi/               # HTTP handlers
      topics/                # topic graph + edge traversal
      traces/                # retrieval trace recording
      config/                # retrieval config per campaign
    contracts/               # v0 contract artifacts
    config/
      config.example.yaml    # documented example config
    go.mod
  roleplay-frontend/         # Angular RP app (future)
    apps/
      roleplay-web/
    libs/
      rp-character-menu/
      rp-persona-menu/
      rp-lorebook/
      rp-scene-state/
      rp-generation-presets/
      rp-session-config/
      rp-message-decorators/
      rp-layout/
  docker/
    Dockerfile
    docker-compose.yaml
```

## Dependency Direction

```
rusty-crew (Rust backend, owns protocol truth)
  ↓ generated/shared protocol types
rusty-view (separate repo — boring chat client kit, zero RP awareness)
  ↓ versioned package dependency
rusty-roleplay (this repo)
  ├── lorekeep (Go service — called by rusty-crew over HTTP)
  └── roleplay-frontend (Angular — consumes rusty-view packages)
```

`rusty-view` must know nothing about roleplay concepts. `rusty-roleplay`
may know about characters, personas, lorebooks, scene state, and presets.

`lorekeep` is called by the rusty-crew RP harness (narrator + mechanic tools)
over HTTP. The frontend may also call lorekeep directly for admin operations
(lore management UI). lorekeep knows nothing about rusty-crew internals —
it is a standalone HTTP API.

---

# Go Codestyle (lorekeep)

Adapted from den-services' codestyle (see `den-services/CODESTYLE.md` and
`den-services/docs/go-codestyle.md`). Write Go with C#-like structural
discipline, not ceremony.

## Philosophy

- Handler → Service → Store layering.
- Explicit typed domain, request, and response models.
- Constructor injection for dependencies.
- No hidden mutable state.
- No business logic in handlers or stores.
- State transitions as named methods.

Choose explicit, typed, boring Go.

## Service structure

Every Go service in the monorepo follows the same internal structure:

```
<domain>/
  config/
    config.example.yaml         # documented example config shipped with the module
  cmd/
    <service>/main.go          # entry point — wiring only, no logic
  internal/
    types.go                   # domain types (structs, enums, errors, constructors)
    config.go                  # typed Config struct loaded from config file
    state.go                   # state machine methods on domain types
    store.go                   # database access (SQL lives here)
    service.go                 # business logic, cross-service coordination
    handler.go                 # HTTP handlers — validate input, shape response
    dto.go                     # request/response DTOs (separate from domain types)
```

Rules:
- `main.go` contains wiring only: read config, construct dependencies, start server. No business logic.
- `handler.go` validates input, calls the service layer, shapes the HTTP response. No business logic, no SQL.
- `service.go` owns business logic, cross-service coordination, and invariant enforcement. No SQL, no HTTP types.
- `store.go` owns all SQL, including atomic compare-and-swap state transitions. No business logic, no HTTP types.
- `types.go` owns domain types, enums, and constructors.
- `state.go` owns state machine methods on domain types.
- `dto.go` owns request/response DTOs. These are separate from domain types.
- `config.go` owns the typed config struct and loading logic.
- An `internal/` package should have no more than ~8 non-test `.go` files.

## Types

- Domain concepts get named structs, not `map[string]any`.
- Invariant-bearing domain objects use private fields with accessors and
  transition methods.
- Enum-like values use typed string constants with `IsValid()` methods.
- Nullable fields use pointers, not sentinel values.

```go
// GOOD — typed struct with private fields
type Entry struct {
    id           int64
    slug         string
    campaignID   string
    canonLevel   CanonLevel
    // ...
}

func (e *Entry) ID() int64          { return e.id }
func (e *Entry) Slug() string       { return e.slug }
func (e *Entry) CanonLevel() CanonLevel { return e.canonLevel }
```

## Constructors and rehydration

New-creation constructors validate invariants and generate fresh values.
Database loads use separate package-local rehydration constructors that
validate persisted state without resetting IDs, timestamps, or lifecycle
fields.

State changes go through transition methods. Contested transitions still
depend on atomic store methods for concurrency authority.

```go
// New-creation constructor — generates IDs, timestamps
func NewEntry(slug, campaignID string, ...) (*Entry, error) { ... }

// Rehydration constructor — package-local, no generated values
func rehydrateEntry(id int64, slug string, ...) (*Entry, error) { ... }
```

## Errors

- Expected failures use sentinel errors checked with `errors.Is`.
- Structured context can use typed errors.
- Wrap errors with context, never swallow them.
- Handlers map service errors through a shared API error registry.
- No `panic` in service code. No `log.Fatal` outside `main.go`.

## Handler → Service → Store layering

**Handlers:** validate request format, call service methods, return DTOs.
No SQL, no business logic.

**Services:** take `context.Context` first for I/O methods. Enforce invariants,
coordinate dependencies. For contested state transitions, delegate to atomic
store methods — no read-modify-write.

**Stores:** own all SQL. Use explicit column lists, never `SELECT *`. Use
parameterized Postgres/SQLite placeholders. Implement compare-and-swap
transitions with preconditioned `WHERE` clauses.

```go
// Atomic claim — the store's ClaimPending does a conditional UPDATE
// WHERE state = 'pending' RETURNING *. The database arbitrates the race.
func (s *intentStore) ClaimPending(ctx context.Context, ...) (*Entry, error) {
    row := s.db.QueryRow(ctx, claimPendingSQL, ...)
    // ...
}

const claimPendingSQL = `
    UPDATE entries
    SET state = 'claimed', claim_token = $1
    WHERE id = $2 AND state = 'pending'
    RETURNING id, slug, campaign_id, state, ...`
```

## Interfaces and injection

- Define interfaces at the consumer and keep them narrow.
- Use constructor injection.
- Define an interface only when there is a real second implementation need
  (tests, remote client, alternate store, boundary seam).
- Do not create service locators, global singletons, or decorative
  interface hierarchies.

```go
// In service.go — the CONSUMER defines the interface it needs
type EntryStore interface {
    ClaimPending(ctx context.Context, id int64, ...) (*Entry, error)
    GetByID(ctx context.Context, id int64) (*Entry, error)
}

func NewEntryService(store EntryStore, clock func() time.Time) *EntryService {
    return &EntryService{store: store, clock: clock}
}
```

## Configuration

Nothing that varies by deployment is hardcoded. Each module owns a typed
`Config` struct loaded from a YAML or JSON config file. The config file path
is the normal environment variable. Secrets may use environment substitution,
but individual tunables should not be scattered across environment variables.

Every config file is validated at load time. Every module ships a documented
`config/config.example.yaml`.

```go
type Config struct {
    DBPath          string        `yaml:"db_path"`
    ListenAddr      string        `yaml:"listen_addr"`
    MaxRecallBudget int           `yaml:"max_recall_budget"`
    DefaultTTL      time.Duration `yaml:"default_ttl"`
}

func LoadConfig(path string) (*Config, error) {
    // read, unmarshal, validate
}
```

## Forbidden Go patterns

- `init()` functions.
- Package-level mutable state.
- Domain behavior driven by reflection.
- Goroutines launched from handlers without lifecycle ownership.
- `interface{}` or `any` in domain types.
- Clever concurrency in request paths.
- Hardcoded tunable ports, URLs, TTLs, thresholds, or timeouts.
- No `log.Fatal` outside `main.go`.

## Go testing

Tests live next to source. Use table-driven tests for state transitions and
edge cases. Service tests mock dependencies. Store tests use a real SQLite
test database when SQL behavior matters.

---

# TypeScript/Angular Codestyle (roleplay-frontend)

Adapted from rusty-view's codestyle. TypeScript in this repo is written for
agent governance and long-term maintainability, not clever terseness.

## Write code that explains itself

Every function, variable, and type should be readable by a reviewer agent who
has never seen this codebase.

**Bad:**
```typescript
const d = msgs.filter(m => m.s === 'act').map(m => m.b).flat();
```

**Good:**
```typescript
const activeMessageBlocks = messages
  .filter(message => message.status === 'active')
  .map(message => message.blocks)
  .flat();
```

## Prefer explicit named intermediates over chained expressions

**Bad:**
```typescript
return events
  .filter(e => e.kind === 'MessageDelta')
  .reduce((proj, e) => applyDelta(proj, e.payload), initialProjection);
```

**Good:**
```typescript
const messageDeltas = events.filter(event => event.kind === 'MessageDelta');
const updatedProjection = messageDeltas.reduce(
  (projection, event) => applyDelta(projection, event.payload),
  initialProjection,
);
return updatedProjection;
```

## No clever abstractions until duplication has stabilized

Do not create generic utilities, base classes, or framework-shaped machinery
until the same pattern has appeared at least three times with stable shape.
Premature abstraction is the primary way frontend code becomes unmaintainable.

When you do abstract, name the abstraction after what it does. `MessageBlockRenderer`
is good. `AbstractBlockStrategy` is bad.

## Keep mutation local and visible

Prefer immutable updates. When mutation is necessary, keep it local to the
smallest possible scope and make it visible. **Never** mutate shared state,
store signals directly from components, or create hidden mutable singletons.

## Small functions with explicit verbs

```typescript
// Good: each function name is an explicit verb
function projectMessageFromDeltas(deltas: MessageDelta[]): ChatMessage { ... }
function applyToolCallBlock(message: ChatMessage, call: ToolCallEvent): ChatMessage { ... }
function shouldAutoScroll(currentScroll: ScrollPosition, streamState: StreamState): boolean { ... }
```

## Angular component rules

- **Presentational components** must not inject application services. They
  receive data through `@Input()` and emit events through `@Output()` or
  typed callbacks.
- **Container/shell components** may inject the store and are the bridge
  between store state and presentational components.
- Components must have empty/loading/error/long-content states where relevant.
- Hot render paths (transcript renderer) must avoid expensive inline
  computations — offload to workers.
- Use `ChangeDetectionStrategy.OnPush` everywhere.
- Use Angular Signals for reactivity. Do not use BehaviorSubject or RxJS
  subjects for local component state.

## Exhaustive type handling

Event handling and discriminated unions must be exhaustive. The TypeScript
compiler should reject unhandled cases.

```typescript
function handleEvent(event: ConversationEvent): void {
  switch (event.kind) {
    case 'MessageStarted': return handleMessageStarted(event);
    case 'MessageDelta': return handleMessageDelta(event);
    case 'MessageCompleted': return handleMessageCompleted(event);
    // No default — compiler enforces exhaustive handling
  }
}
```

## Library boundary rules

The roleplay-frontend consumes rusty-view packages. It must not:

- Fork or duplicate rusty-view library code
- Add RP-specific concepts to rusty-view packages
- Import from rusty-view `internal/` paths

RP-specific UI is added through rusty-view extension tokens:
- `CHAT_MESSAGE_DECORATORS` — for message-level RP decoration
- Sidebar panel slots — for lorebook, character menus, scene config
- Mode switching — for RP ↔ mechanic mode toggle

## Forbidden TypeScript patterns

- No `any` — ever. Use `unknown` and narrow with type guards if needed.
- No non-null assertions (`!`). Handle nullability explicitly.
- No type assertions (`as`) unless justified in a comment and reviewed.
- No `eslint-disable` without planner-approved reason.
- No new dependency without ADR/planner approval.
- No direct import from another library's internals — public API entrypoints only.
- No circular dependencies.
- No hand-written protocol type duplicates.
- No direct network calls outside the transport layer.
- No direct browser storage (localStorage/sessionStorage/IndexedDB) outside
  the storage adapter.
- No domain logic inside Angular components.
- No global state singleton unless explicitly approved.
- No global CSS except reset and design tokens.
- No RP imports inside rusty-view packages (moot — rusty-view is a separate
  repo, but agents working on this repo should understand the boundary).

---

## Local Commands

### lorekeep (Go)

```bash
# Build
go build ./cmd/lorekeep

# Run (with config)
./lorekeep --config config/config.yaml

# Tests
go test ./...

# Contract validation
go run ./cmd/lorekeep-validate
```

### roleplay-frontend (Angular, future)

```bash
# Install dependencies
npm install

# Development server
npm start

# Full CI gate
npm run ci

# Individual checks
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

---

## Design Principles

- **Boring architecture**: Libraries you call > frameworks that call you.
- **Explicit over clever**: Every import, function, and type should explain
  intent to a reviewer who has never seen this codebase.
- **Boundaries are the product**: The module boundary structure IS the
  architecture. Do not dissolve boundaries for convenience.
- **Config is never hardcoded**: Every tunable value in typed config files
  with documented `config.example.yaml`.
- **Desired failure mode**: The agent cannot compile the wrong thing because
  types, lint rules, and module boundaries prevent it.

## Suggested AGENTS.md Policy Text

Agents working in this repo must treat architecture as fixed unless explicitly
assigned an architecture task.

Do not create new Go packages, Angular libraries, dependencies, or
cross-module imports without planner approval.

Go code: follow Handler→Service→Store layering. Constructor injection.
No `init()`. No package-level mutable state. Typed config structs only.

Frontend code: consume rusty-view packages. Never fork or duplicate them.
Add RP concepts through extension tokens, not by modifying base chat
mechanics.

Never manually duplicate protocol types. Generate or derive from schema.

Never hardcode tunable ports, URLs, TTLs, thresholds, or timeouts.

Prefer explicit, boring, typed code over clever abstractions.

When unsure, stop and ask the planner for a boundary decision.
