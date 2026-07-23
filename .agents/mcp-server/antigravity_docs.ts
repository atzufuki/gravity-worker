import { Server } from "npm:@modelcontextprotocol/sdk@1.5.0/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.5.0/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.5.0/types.js";

const TOPICS = [
  "home",
  "agent-features",
  "editor-features",
  "faq",
  "features",
  "get-started",
  "rest-api"
];

// Cache to store documents in memory after initial download
const docCache: Record<string, string> = {};

// Helper to get or fetch document content
async function getOrFetchDoc(topic: string): Promise<string> {
  if (docCache[topic]) {
    return docCache[topic];
  }
  const url = `https://antigravity.google/assets/docs/${topic}/${topic}.md`;
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
  console.error("Prefetching all documentation files...");
  for (const topic of TOPICS) {
    try {
      await getOrFetchDoc(topic);
    } catch (err) {
      console.error(`Warning: Failed to prefetch topic '${topic}':`, err);
    }
  }
  console.error("Documentation prefetch complete.");
}

// Start prefetching in the background
prefetchAll().catch((err) => console.error("Prefetch error:", err));

const server = new Server(
  {
    name: "antigravity-docs-mcp",
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
        description: "List all available documentation topics.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_topic_documentation",
        description: "Retrieve the full Markdown documentation text for a given topic.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic key (e.g. 'home', 'agent-features', 'editor-features', 'faq', 'features', 'get-started', 'rest-api').",
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "search_documentation",
        description: "Search all documentation topics for matching query text.",
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
    // Ensure all topics are loaded
    for (const topic of TOPICS) {
      if (!docCache[topic]) {
        try { await getOrFetchDoc(topic); } catch (_) {}
      }
    }

    const topicsList = Object.entries(docCache).map(([key, content]) => {
      const titleMatch = content.match(/title:\s*(.*)/i);
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
    if (!TOPICS.includes(topic)) {
      return {
        content: [
          {
            type: "text",
            text: `Topic '${topic}' not found. Available topics: ${TOPICS.join(", ")}`,
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
    for (const topic of TOPICS) {
      if (!docCache[topic]) {
        try { await getOrFetchDoc(topic); } catch (_) {}
      }
    }

    const results = Object.entries(docCache)
      .filter(([_, content]) => content.toLowerCase().includes(query))
      .map(([key, content]) => {
        const titleMatch = content.match(/title:\s*(.*)/i);
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
console.error("Antigravity MCP server running on stdio.");
