# Roleplay System Design Documents

Working design notes for a service-oriented collaborative fiction / roleplay
system built on rusty-crew infrastructure.

## Status

Active implementation. Den project `rusty-roleplay`. These documents capture
architecture decisions and reasoning for evaluation during implementation.

## Context

The goal is a replacement for SillyTavern-style roleplay that uses agent
infrastructure (rusty-crew) and a purpose-built lore/memory service rather
than client-side prompt assembly and keyword-triggered lore injection.

This repository (`rusty-roleplay`) is a Go + Angular monorepo containing:

- **lorekeep** — Go lore/memory service at `/lorekeep/`
- **roleplay-frontend** — Angular RP chat application consuming rusty-view
  packages (not yet scaffolded)

Key prior art:

- **QuillForge** (`/home/dev/quillforge`) — previous attempt, C#/.NET, multi-agent pipeline. Too heavyweight for RP; lessons captured in `04-quillforge-postmortem.md`.
- **SillyTavern** (`/home/research/SillyTavern`) — current solution for the users. Works but architecturally fragile, cache-hostile, and couples prompt logic to the UI.
- **rusty-crew** (`/home/dev/rusty-crew`) — Rust+TS agent service. Planned host for the RP harness (narrator + mechanic profiles, lorekeep adapter tools).
- **rusty-view** (`/home/dev/rusty-view`) — Boring debug chat client + reusable chat client kit. Separate repo. RP frontend here consumes rusty-view packages.
- **den-memory** (`/home/dev/den-memory`) — Graph-guided memory substrate. Architectural template for lorekeep, but wrong domain fit for direct use.

## Related design documents

Existing docs that informed this design:

| Document | Relevance |
|---|---|
| `rusty-view.md` | Frontend architecture for rusty-crew chat. The `rusty-view` / `rusty-roleplay` two-repo separation is the frontend foundation. |
| `den-services/docs/go-codestyle.md` | Go style guide. lorekeep follows these patterns (Handler→Service→Store, constructor injection, typed config). |

## Document Index

| Document | Purpose |
|---|---|
| `00-system-overview.md` | Core architecture shape, key decisions, design philosophy |
| `01-lore-service-design.md` | Purpose-built RP lore/memory service ("lorekeep") |
| `02-narrator-agent-and-loop.md` | Single-agent loop, two-phase generation, tool surface |
| `03-mechanic-ooc-agent.md` | Diagnostic/mechanic agent, separate sessions, config tools |
| `04-quillforge-postmortem.md` | What QuillForge did right/wrong, what carries forward |
| `06-context-compaction.md` | Scene-aware compaction, director's notes, fact extraction, tool-result lifecycle |
| `05-project-layout.md` | Repos, services, dependency graph, implementation phases |

## Naming

No project name chosen yet. Working names used in these docs:

- **The harness** — the overall RP system (rusty-crew profiles + tools)
- **lorekeep** — working name for the RP lore/memory service (Go, this repo)
- **narrator agent** — the in-character RP agent
- **mechanic agent** — the OOC diagnostic/configuration agent

These are placeholders for Patch to rename.
