# Wedding Memory Vault — OpenCode Worker System

Copy this scaffold into the application repository root. OpenCode discovers `AGENTS.md`, `.opencode/agents/*.md` and `.opencode/commands/*.md`.

Start OpenCode in the repo root. Recommended first commands:
- `/status`
- `/plan phase 0 foundation`
- `/build phase 0 foundation`
- `/test full suite`
- `/security-audit`
- `/expiry-test`
- `/release-check`

The orchestrator coordinates specialists. Every specialist must test, review its diff, create a handoff and update worker status.
