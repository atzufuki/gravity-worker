# AGENTS.md

Welcome AI Agent! This document provides technical context, codebase conventions, and execution guidelines for working on the **GravityWorker** repository.

---

## 1. Project Overview

**GravityWorker** is an AI-agent runner and orchestrator designed to run tasks in isolated Git worktrees and CI environments.
- **Runtime:** Deno 2.x
- **Framework:** [Alexi](https://github.com/atzufuki/alexi) (Django-inspired full-stack framework for Deno)
- **Database Backend:** DenoKV (`@alexi/db/backends/denokv`)
- **CLI Framework:** `@std/cli` for [project/cli.ts](file:///var/home/atzufuki/Code/gravity-worker/project/cli.ts)

---

## 2. Directory Structure & Architecture

- **[project/cli.ts](file:///var/home/atzufuki/Code/gravity-worker/project/cli.ts):** User-facing CLI entry point. Handles arguments (`--prompt`, `--issue`, `--agent`, `--dry-run`) via `@std/cli/parse-args`.
- **[manage.ts](file:///var/home/atzufuki/Code/gravity-worker/manage.ts):** Alexi framework management entry point (`runserver`, `migrate`, `createsuperuser`, `test`).
- **[project/settings.ts](file:///var/home/atzufuki/Code/gravity-worker/project/settings.ts):** Central project settings (`DATABASES`, `INSTALLED_APPS`, `MIDDLEWARE`).
- **[src/gravity-worker/](file:///var/home/atzufuki/Code/gravity-worker/src/gravity-worker/):** Primary app package containing models, views, and URL patterns.
- **[.agents/](file:///var/home/atzufuki/Code/gravity-worker/.agents/):** MCP servers, configuration (`mcp_config.json`), and custom skills.

---

## 3. Development Guidelines for Agents

### A. Environment & Commands
- **Run CLI:** `deno task start -- [args]`
- **Run Tests:** `deno task test`
- **Compile Binary:** `deno task compile`
- **Run Management Commands:** `deno run -A --unstable-kv manage.ts [command]`

### B. Code Conventions
1. **TypeScript Strictness:** Always maintain strict TypeScript types. Avoid using explicit `any` when possible.
2. **Imports:** Use import maps defined in `deno.jsonc` (e.g., `@gravity-worker/` maps to `./src/gravity-worker/`).
3. **Alexi Framework Conventions:**
   - Models extend `Model` or `AbstractUser` from `@alexi/db` / `@alexi/auth`.
   - Always define `static objects = new Manager(ModelName)` on models.
4. **Git Worktree Hygiene:** When adding feature logic for background task isolation, ensure temporary worktrees are created outside the working directory or automatically cleaned up upon exit.

---

## 4. Verification Protocol

Before declaring any task completed:
1. Run `deno task test` to ensure all unit and integration tests pass.
2. Run `deno task start --help` or test relevant CLI flags to verify CLI responsiveness.
3. If modifying build configuration, run `deno task compile` to ensure binary compilation succeeds.
