---
name: create-skill
description: Designing, writing, and registering new agent skills.
---

# Creating Agent Skills

Use this skill when you need to define and register a new capability (agent skill) in the repository.

## Tooling Strategy
- Use the `write_to_file` tool to create `SKILL.md` and any supporting scripts/references.
- Use code edit tools (`replace_file_content`) to update `AGENTS.md`.

## Workflow

### 1. Design & Scope
- **Trigger**: Identify the exact user request or context that should trigger this skill.
- **Complexity**:
  - *Simple*: A single `SKILL.md` file containing checklists and guidelines.
  - *Complex*: Needs supporting subdirectories (e.g., `scripts/` for helper executables, `references/` for detailed docs/manuals).

### 2. Progressive Disclosure (The 500-Word Rule)
- Keep the main `SKILL.md` concise and under 500 words to conserve LLM context tokens.
- Refactor extensive references, APIs, or large checklists into `references/` or offload them to an MCP server.

### 3. File Structure
Create the skill directory at `.agents/skills/[skill-name]/`.
Based on complexity, add:
- `[skill-name]/SKILL.md` (Required - main instruction file)
- `[skill-name]/scripts/` (Optional - helper scripts/code)
- `[skill-name]/references/` (Optional - detailed text manuals)
- `[skill-name]/resources/` (Optional - templates or assets)

### 4. Manifest Format
The `SKILL.md` file must start with a YAML frontmatter block:
```markdown
---
name: [skill-name]
description: [Short, single-sentence summary of what the skill does]
---

# [Human Readable Title]

[Concise workflow instructions, checklists, and guidelines]
```

### 5. Registration
Add the new skill to the `## Agent Skills` section of [AGENTS.md](file:///var/home/atzufuki/Code/kelo/AGENTS.md):
- **Format**: `- **[<skill-name>](file:///var/home/atzufuki/Code/kelo/.agents/skills/<skill-name>/SKILL.md)**: <Description matching the YAML frontmatter>`
