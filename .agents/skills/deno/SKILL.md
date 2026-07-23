---
name: deno
description: Guidelines and tools for working with Deno runtime, tasks, tests, and configuration.
---

# Deno Development Skill

Use this skill when you need to run, test, compile, or debug code using the Deno runtime, configure Deno settings, or query Deno documentation.

## 1. Leverage the Deno Docs MCP Server
- Do NOT guess Deno runtime APIs, CLI arguments, or configuration options.
- Query the `deno-docs` MCP server tools to search and retrieve Deno runtime documentation:
  - `list_topics`: Get a list of all available topics (e.g. `installation`, `configuration`, `security`, `http-server`, `cli-run`, `cli-test`).
  - `search_documentation(query)`: Search Deno manual topics by query phrase or keyword.
  - `get_topic_documentation(topic)`: Retrieve the full Markdown details for a specific topic.

## 2. Deno CLI & Tasks Execution
- Use `deno run` for executing TS/JS files.
- Inspect `deno.json` for project-specific tasks (e.g. `deno task dev`, `deno task start`).
- **Never start long-running background development processes or servers** on your own unless explicitly requested by the user.

## 3. Testing Workflows
- Execute tests using `deno test` with necessary permission flags.
- For the MTG Decks visualizer:
  ```bash
  deno test --allow-read --allow-env tests/deck_visualizer_test.ts
  ```
- Keep DOM testing lightweight using `happy-dom`. Do not serialize circular/DOM elements to console.log as it causes massive print lag.
