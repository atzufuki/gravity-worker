---
name: html-props
description: Guidelines on using the HTML Props MCP server for HTML properties documentation and metadata.
---

# HTML Props Skill

Use this skill when you need to query, verify, or reference HTML properties, layout attributes, builder APIs, JSX configuration, signals, or element reconciliation in the html-props library.

## 1. Leverage the MCP Server
- Do NOT guess property metadata, library APIs, or builder options.
- Always query the `html-props-docs` MCP server tools to search and retrieve documentation:
  - `list_topics`: Get a list of all documented topics in html-props (e.g. `getting-started`, `guide`, `builder`, `reconciliation`, `signals`).
  - `search_documentation(query)`: Search the HTML Props docs database using keywords.
  - `get_topic_documentation(topic)`: Retrieve the full details for the specified topic.

## 2. Documentation Inquiries
- If the user asks questions about HTML Props or its properties, search the documentation database first, then present the findings clearly and accurately.
