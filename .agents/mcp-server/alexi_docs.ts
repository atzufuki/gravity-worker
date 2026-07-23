import { Server } from "npm:@modelcontextprotocol/sdk@1.5.0/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.5.0/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.5.0/types.js";

const TOPIC_PATHS: Record<string, string> = {
  "readme": "README.md",
  "getting-started": "docs/getting-started.md",
  "tutorial": "docs/tutorial.md",
  "django-comparison": "docs/django-comparison.md",
  "deployment": "docs/deployment.md",
  "offline-mpa": "docs/offline-mpa.md",
  "urls": "docs/urls.md",
  "views": "docs/views.md",
  "admin": "docs/admin/admin.md",
  "authentication": "docs/auth/authentication.md",
  "capacitor": "docs/capacitor/capacitor.md",
  "management": "docs/core/management.md",
  "scaffolding": "docs/create/scaffolding.md",
  "db-backends": "docs/db/backends.md",
  "db-migrations-ci": "docs/db/migrations-ci.md",
  "db-migrations": "docs/db/migrations.md",
  "db-models": "docs/db/models.md",
  "http-application": "docs/http/application.md",
  "middleware": "docs/middleware/middleware.md",
  "filtering": "docs/restframework/filtering.md",
  "serializers": "docs/restframework/serializers.md",
  "viewsets": "docs/restframework/viewsets.md",
  "staticfiles": "docs/staticfiles/staticfiles.md",
  "storage": "docs/storage/storage.md",
  "webui": "docs/webui/webui.md",
};

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
  const url = `https://raw.githubusercontent.com/atzufuki/alexi/main/${relPath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch documentation for topic '${topic}': ${res.statusText}`);
  }
  const content = await res.text();
  docCache[topic] = content;
  return content;
}

// Prefetch all docs at startup to enable full-text search and metadata list
async function prefetchAll() {
  console.error("Prefetching all Alexi documentation files...");
  for (const topic of Object.keys(TOPIC_PATHS)) {
    try {
      await getOrFetchDoc(topic);
    } catch (err) {
      console.error(`Warning: Failed to prefetch topic '${topic}':`, err);
    }
  }
  console.error("Alexi documentation prefetch complete.");
}

// Start prefetching in the background
prefetchAll().catch((err) => console.error("Prefetch error:", err));

const server = new Server(
  {
    name: "alexi-docs-mcp",
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
        description: "List all available documentation topics for the Alexi framework.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_topic_documentation",
        description: "Retrieve the full Markdown documentation text for a given topic key.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic key (e.g. 'getting-started', 'tutorial', 'readme', 'django-comparison', 'db-models', etc.).",
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "search_documentation",
        description: "Search all Alexi documentation topics for matching query text.",
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
      // Extract title from the first H1 header '# Title' or fallback to key
      const titleMatch = content.match(/^#\s+(.*)/m);
      const title = titleMatch ? titleMatch[1].trim() : key;
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
        const titleMatch = content.match(/^#\s+(.*)/m);
        const title = titleMatch ? titleMatch[1].trim() : key;
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
console.error("Alexi MCP server running on stdio.");
