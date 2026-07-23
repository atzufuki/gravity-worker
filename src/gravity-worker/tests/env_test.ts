/**
 * GravityWorker - Environment Example Template Tests
 */

import { assertEquals, assert } from "@std/assert";

Deno.test("Environment Template - .env.example exists and contains key variables", async () => {
  const content = await Deno.readTextFile(".env.example");
  assert(content.length > 0, ".env.example should not be empty");

  const requiredKeys = [
    "GEMINI_API_KEY",
    "GITHUB_TOKEN",
    "GRAVITY_WORKER_APP_ID",
    "GRAVITY_WORKER_PRIVATE_KEY",
    "DEBUG",
    "SECRET_KEY",
    "DENO_KV_PATH",
    "DENO_KV_URL",
  ];

  for (const key of requiredKeys) {
    assert(
      content.includes(key),
      `.env.example should contain environment key: ${key}`,
    );
  }
});
