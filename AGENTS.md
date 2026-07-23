# AGENTS.md

Welcome AI Agent! This document provides technical context, codebase conventions, and execution guidelines for working on the **Herkules** repository.

---

## 1. Project Overview

**Herkules** (Hercules beetle) is an AI-agent runner and orchestrator designed to run tasks in isolated Git worktrees and CI environments.
- **Runtime:** Deno 2.x
- **Framework:** [Alexi](https://github.com/atzufuki/alexi) (Django-inspired full-stack framework for Deno)
- **Database Backend:** DenoKV (`@alexi/db/backends/denokv`)
- **CLI Framework:** `@std/cli` for [src/cli/cli.ts](file:///var/home/atzufuki/Code/gravity-worker/src/cli/cli.ts)

---

## 2. Directory Structure & Architecture

- **[src/cli/](file:///var/home/atzufuki/Code/gravity-worker/src/cli/):** CLI Application module (`@cli/`):
  - `cli.ts`: Universal CLI entry point (`run`, `install`, `uninstall`, `proxy`, `server`, `status`, `version`) via `@std/cli/parse-args`.
  - `commands/`: Alexi management commands (`install.ts`, `uninstall.ts`, `proxy.ts`, `server.ts`, `list_worktrees.ts`, `clean_worktrees.ts`).
  - `tests/`: CLI unit tests.
- **[src/web/](file:///var/home/atzufuki/Code/gravity-worker/src/web/):** Web Application module (`@web/`):
  - `http.ts`: Backward compatibility wrapper for `project/http.ts`.
  - `urls.ts`: Django-style URL routing for `/health/`, `/api/token`, `/ws/`, `/tunnel/`.
  - `views.ts`: View handlers for health checks, keyless token relay, and WebSocket tunnel endpoints.
  - `relay.ts`: Native token relay & WebSocket tunnel registry subsystem.
  - `tests/`: Web app unit tests.
- **[src/herkules/](file:///var/home/atzufuki/Code/gravity-worker/src/herkules/):** Core Herkules engine package (`@herkules/`):
  - `git.ts`: Isolated Git worktree creation, diffing, clean staging, commit & push.
  - `runner.ts`: Agent runners (`AntigravityRunner`, `GeminiRunner`, `CustomAgentRunner`).
  - `github.ts`: GitHub API parsing, event payload context, issue comment posting, PR creation.
  - `github_app.ts`: GitHub App Manifest Flow, JWT authentication, 100% zero-touch repo setup.
  - `artifacts.ts`: Markdown artifact generator (`implementation_plan.md`, `walkthrough.md`).
  - `conventional.ts`: Conventional Commits branch and PR metadata generator.
  - `tests/`: Core unit and integration tests.
- **[project/http.ts](file:///var/home/atzufuki/Code/gravity-worker/project/http.ts):** Production HTTP server entry point for Deno Deploy / `deno serve`.
- **[project/settings.ts](file:///var/home/atzufuki/Code/gravity-worker/project/settings.ts):** Central project settings (`DATABASES`, `INSTALLED_APPS`, `MIDDLEWARE`).
- **[manage.ts](file:///var/home/atzufuki/Code/gravity-worker/manage.ts):** Alexi framework management entry point (`runserver`, `list_worktrees`, `clean_worktrees`, `install`, `uninstall`, `proxy`, `server`).
- **[docs/github.md](file:///var/home/atzufuki/Code/gravity-worker/docs/github.md):** GitHub integration and 100% zero-touch automated setup guide.
- **[docs/deploy.md](file:///var/home/atzufuki/Code/gravity-worker/docs/deploy.md):** Deno Deploy edge deployment guide.
- **[.agents/](file:///var/home/atzufuki/Code/gravity-worker/.agents/):** MCP servers, configuration (`mcp_config.json`), and custom skills.

---

## 3. Development Guidelines for Agents

### A. Environment & Commands
- **Run CLI:** `deno task start -- [args]`
- **Run Zero-Touch Setup:** `deno task start install`
- **Run Tests:** `deno task test`
- **Compile Binary:** `deno task compile`
- **Run Management Commands:** `deno run -A --unstable-kv manage.ts [command]`

### B. Code Conventions
1. **TypeScript Strictness:** Always maintain strict TypeScript types. Avoid using explicit `any` when possible.
2. **Imports:** Use import maps defined in `deno.jsonc`:
   - `@herkules/` maps to `./src/herkules/`
   - `@cli/` maps to `./src/cli/`
   - `@web/` maps to `./src/web/`
3. **Alexi Framework Conventions:**
   - Management commands extend `BaseCommand` from `@alexi/core/management`.
   - App modules export an `AppConfig` from `mod.ts`.
4. **Git Worktree & Artifact Hygiene:**
   - Temporary worktrees are created under `.worktrees/`.
   - Report artifacts (`implementation_plan.md`, `walkthrough.md`) are saved into `.herkules/` and strictly excluded from target repo git commits.

---

## 4. Verification Protocol

Before declaring any task completed:
1. Run `deno task test` to ensure all unit and integration tests pass (12+ tests).
2. Run `deno task start --help` or test relevant CLI flags to verify CLI responsiveness.
3. If modifying build configuration, run `deno task compile` to ensure binary compilation succeeds.
