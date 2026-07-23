import { Server } from "npm:@modelcontextprotocol/sdk@1.5.0/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.5.0/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.5.0/types.js";

const TOPIC_PATHS: Record<string, string> = {
  // Getting Started
  "installation": "runtime/getting_started/installation.md",
  "setup-environment": "runtime/getting_started/setup_your_environment.md",

  // Fundamentals
  "configuration": "runtime/fundamentals/configuration.md",
  "modules": "runtime/fundamentals/modules.md",
  "node-compatibility": "runtime/fundamentals/node.md",
  "security": "runtime/fundamentals/security.md",
  "typescript": "runtime/fundamentals/typescript.md",
  "cron": "runtime/fundamentals/cron.md",
  "debugging": "runtime/fundamentals/debugging.md",
  "ffi": "runtime/fundamentals/ffi.md",
  "http-server": "runtime/fundamentals/http_server.md",
  "workspaces": "runtime/fundamentals/workspaces.md",

  // CLI Reference
  "cli-run": "runtime/reference/cli/run.md",
  "cli-test": "runtime/reference/cli/test.md",
  "cli-fmt": "runtime/reference/cli/fmt.md",
  "cli-lint": "runtime/reference/cli/lint.md",
  "cli-compile": "runtime/reference/cli/compile.md",
  "cli-task": "runtime/reference/cli/task.md",
  "cli-bench": "runtime/reference/cli/bench.md",
  "cli-doc": "runtime/reference/cli/doc.md",
  "cli-init": "runtime/reference/cli/init.md",
  "cli-repl": "runtime/reference/cli/repl.md",
  "cli-serve": "runtime/reference/cli/serve.md",
  "cli-upgrade": "runtime/reference/cli/upgrade.md",

  // Reference
  "deno-json": "runtime/reference/deno_json.md",
  "permissions": "runtime/reference/permissions.md",
  "web-apis": "runtime/reference/web_platform_apis.md",
  "node-apis": "runtime/reference/node_apis.md",
  "wasm": "runtime/reference/wasm.md",
  "jsx": "runtime/reference/jsx.md",
  "docker": "runtime/reference/docker.md",

  // Testing
  "testing-basics": "runtime/test/index.md",
  "testing-coverage": "runtime/test/coverage.md",
  "testing-mocking": "runtime/test/mocking.md",
  "testing-sanitizers": "runtime/test/sanitizers.md",
  "testing-snapshots": "runtime/test/snapshots.md",
  "testing-jest-migration": "runtime/test/migrate_from_jest.md",

  // Desktop
  "desktop-index": "runtime/desktop/index.md",
  "desktop-config": "runtime/desktop/configuration.md",
  "desktop-tray": "runtime/desktop/tray_and_dock.md",
  
  // Migration
  "migrate-bun": "runtime/migrate/migrate_from_bun.md",
  "migrate-npm": "runtime/migrate/migrate_from_npm.md"
};

import { join, fromFileUrl, dirname } from "https://deno.land/std@0.224.0/path/mod.ts";

// Cache to store documents in memory after initial download
const docCache: Record<string, string> = {};

// Helper to get or fetch document content
async function getOrFetchDoc(topic: string): Promise<string> {
  if (docCache[topic]) {
    return docCache[topic];
  }
  const relPath = TOPIC_PATHS[topic];
  if (!relPath) {
    throw new Error(`Unknown topic: ${topic}`);
  }

  // Yritetään lukea paikallisesta välimuistista ensin
  const scriptDir = dirname(fromFileUrl(import.meta.url));
  const docsDir = join(scriptDir, "docs");
  const localPath = join(docsDir, `${topic}.md`);

  try {
    const localContent = await Deno.readTextFile(localPath);
    docCache[topic] = localContent;
    return localContent;
  } catch (_) {
    // Jos ei löydy paikallisesti, haetaan verkosta (fallback)
    const url = `https://raw.githubusercontent.com/denoland/docs/main/${relPath}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch documentation for topic '${topic}': ${res.statusText}`);
    }
    const content = await res.text();
    docCache[topic] = content;

    // Yritetään tallentaa paikalliseen välimuistiin tulevaa offline-käyttöä varten
    try {
      await Deno.mkdir(docsDir, { recursive: true });
      await Deno.writeTextFile(localPath, content);
    } catch (_) {}

    return content;
  }
}

// Prefetch all docs at startup to enable full-text search and metadata list
async function prefetchAll() {
  console.error("Prefetching all Deno documentation files...");
  for (const topic of Object.keys(TOPIC_PATHS)) {
    try {
      await getOrFetchDoc(topic);
    } catch (err) {
      console.error(`Warning: Failed to prefetch topic '${topic}':`, err);
    }
  }
  console.error("Deno documentation prefetch complete.");
}

// Start prefetching in the background
prefetchAll().catch((err) => console.error("Prefetch error:", err));

const server = new Server(
  {
    name: "deno-docs-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_topics",
        description: "List all available Deno documentation topics.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_topic_documentation",
        description: "Retrieve the full Markdown documentation text for a given Deno topic key.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The Deno topic key (e.g. 'installation', 'configuration', 'security', 'http-server', 'cli-run', 'cli-test', etc.).",
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "search_documentation",
        description: "Search all Deno documentation topics for matching query text.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search keyword or phrase.",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_topics") {
    // Ensure all topics are loaded to extract titles
    for (const topic of Object.keys(TOPIC_PATHS)) {
      if (!docCache[topic]) {
        try { await getOrFetchDoc(topic); } catch (_) {}
      }
    }

    const topicsList = Object.entries(docCache).map(([key, content]) => {
      // Extract title from frontmatter title: or first H1 header '# Title' or fallback to key
      const titleMatch = content.match(/^title:\s*(.*)/im) || content.match(/^#\s+(.*)/m);
      const title = titleMatch ? titleMatch[1].trim().replace(/['"]/g, "") : key;
      return { key, title };
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(topicsList, null, 2),
        },
      ],
    };
  }

  if (name === "get_topic_documentation") {
    const topic = args?.topic as string;
    if (!TOPIC_PATHS[topic]) {
      return {
        content: [
          {
            type: "text",
            text: `Topic '${topic}' not found. Available topics: ${Object.keys(TOPIC_PATHS).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const content = await getOrFetchDoc(topic);
      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching topic '${topic}': ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "search_documentation") {
    const query = (args?.query as string || "").toLowerCase();
    
    // Ensure all topics are loaded for the search
    for (const topic of Object.keys(TOPIC_PATHS)) {
      if (!docCache[topic]) {
        try { await getOrFetchDoc(topic); } catch (_) {}
      }
    }

    const results = Object.entries(docCache)
      .filter(([_, content]) => content.toLowerCase().includes(query))
      .map(([key, content]) => {
        const titleMatch = content.match(/^title:\s*(.*)/im) || content.match(/^#\s+(.*)/m);
        const title = titleMatch ? titleMatch[1].trim().replace(/['"]/g, "") : key;
        return { key, title };
      });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Deno MCP server running on stdio.");
