---
name: antigravity
description: Guidelines on using the Antigravity Docs MCP server for developer reference.
---

# Google Antigravity Skill

Use this skill when you need to query, verify, or reference information about the Google Antigravity CLI, SDK, Hooks, or Plugins.

## 1. Leverage the MCP Server
- Do NOT guess configuration structures, CLI arguments, or SDK class methods.
- Always query the `antigravity-docs` MCP server tools to search and retrieve documentation:
  - `list_topics`: Get a list of all documented topics (e.g. `cli`, `sdk`, `hooks`, `plugins`).
  - `search_documentation(query)`: Search the docs database using keywords.
  - `get_topic_documentation(topic)`: Retrieve the full details for the specified topic.

## 2. Documentation Inquiries
- If the user asks questions about Antigravity, search the documentation database first, then present the findings clearly and accurately.
