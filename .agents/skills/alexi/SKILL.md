---
name: alexi
description: Guidelines on using the Alexi MCP server for developer reference.
---

# Alexi Framework Skill

Use this skill when you need to query, verify, or reference information about the Alexi framework, its components, routing, models, views, or database migrations.

## 1. Leverage the MCP Server
- Do NOT guess configuration structures, framework APIs, or CLI commands for Alexi.
- Always query the `alexi-docs` MCP server tools to search and retrieve documentation:
  - `list_topics`: Get a list of all documented topics in Alexi (e.g. `getting-started`, `tutorial`, `db-models`, `views`, `urls`).
  - `search_documentation(query)`: Search the Alexi docs database using keywords.
  - `get_topic_documentation(topic)`: Retrieve the full details for the specified topic.

## 2. Documentation Inquiries
- If the user asks questions about Alexi, search the documentation database first, then present the findings clearly and accurately.
