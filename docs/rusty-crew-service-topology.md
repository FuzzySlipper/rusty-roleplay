# Rusty Crew Service Topology For Rusty Roleplay

Rusty Roleplay consumes Rusty Crew as its agent runtime. The shared development
machine intentionally runs two Rusty Crew services.

## Live Agent Service

- Root: `/home/system/rusty-crew`
- Port: `9347`
- Storage: PostgreSQL
- Use for long-lived manual RP testing and eventual real agent use

The roleplay frontend derives this endpoint by default when served from the same
host: `http://host:4200` uses `http://host:9347`.

## Debug/Test Service

- Root: `/home/system/rusty-crew-debug`
- Port: `9348`
- Storage: SQLite
- Use for noisy live tests, disposable profile creation, roleplay quality
  spikes, and frontend debugging

To target debug from the frontend:

```text
http://host:4200/?api=http://host:9348
```

Do not point automated or repeatable quality tests at the live service unless
the task is specifically testing PostgreSQL/live-service behavior.
