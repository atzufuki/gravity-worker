import { assertEquals, assertExists } from "jsr:@std/assert";

Deno.test("Deno Docs MCP Server Integration", async (t) => {
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-net", "--allow-read", ".agents/mcp-server/deno_docs.ts"],
    stdin: "piped",
    stdout: "piped",
    stderr: "null", // ignore stderr logs during prefetch
  });

  const child = command.spawn();
  const writer = child.stdin.getWriter();
  const reader = child.stdout.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Helper to send a request and read a single JSON-RPC line response
  async function sendAndReceive(requestObj: any): Promise<any> {
    const rawReq = JSON.stringify(requestObj) + "\n";
    await writer.write(encoder.encode(rawReq));

    // Read chunks until we find a newline (a complete JSON-RPC response message)
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      buffer += decoder.decode(value);
      if (buffer.includes("\n")) {
        break;
      }
    }
    return JSON.parse(buffer.trim());
  }

  await t.step("list_tools returns registered tools", async () => {
    const response = await sendAndReceive({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    });

    assertExists(response.result);
    assertExists(response.result.tools);
    
    const toolNames = response.result.tools.map((t: any) => t.name);
    assertEquals(toolNames.includes("list_topics"), true);
    assertEquals(toolNames.includes("get_topic_documentation"), true);
    assertEquals(toolNames.includes("search_documentation"), true);
  });

  await t.step("call_tool list_topics succeeds", async () => {
    const response = await sendAndReceive({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "list_topics",
        arguments: {}
      }
    });

    assertExists(response.result);
    assertExists(response.result.content);
    assertEquals(response.result.content[0].type, "text");
    
    const topics = JSON.parse(response.result.content[0].text);
    // There should be pre-cached topics returned
    assertEquals(Array.isArray(topics), true);
    assertEquals(topics.length > 0, true);
    
    // Topic keys should contain standard keys
    const keys = topics.map((t: any) => t.key);
    assertEquals(keys.includes("installation"), true);
    assertEquals(keys.includes("security"), true);
  });

  await t.step("call_tool search_documentation finds desktop", async () => {
    const response = await sendAndReceive({
      jsonrpc: "2.0",
      id: 25,
      method: "tools/call",
      params: {
        name: "search_documentation",
        arguments: {
          query: "desktop"
        }
      }
    });

    assertExists(response.result);
    assertExists(response.result.content);
    const results = JSON.parse(response.result.content[0].text);
    assertEquals(Array.isArray(results), true);
    assertEquals(results.length > 0, true);
    const keys = results.map((r: any) => r.key);
    assertEquals(keys.includes("desktop-index"), true);
  });

  await t.step("call_tool get_topic_documentation fails for invalid topic", async () => {
    const response = await sendAndReceive({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_topic_documentation",
        arguments: {
          topic: "nonexistent-topic-xyz"
        }
      }
    });

    assertExists(response.result);
    assertEquals(response.result.isError, true);
  });

  // Cleanup process streams to avoid resource leaks
  await writer.close();
  writer.releaseLock();
  await reader.cancel();
  reader.releaseLock();
  
  child.kill();
  await child.status;
});
