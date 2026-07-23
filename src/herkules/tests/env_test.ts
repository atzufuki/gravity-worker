/**
 * Herkules - Environment Example Template Tests
 */

import { assertEquals, assert } from "@std/assert";

Deno.test("Environment Template - .env.example exists and contains key variables", async () => {
  const content = await Deno.readTextFile(".env.example");
  assert(content.length > 0, ".env.example should not be empty");

  const requiredKeys = [
    "GEMINI_API_KEY",
    "GITHUB_TOKEN",
    "HERKULES_APP_ID",
    "HERKULES_PRIVATE_KEY",
    "DEBUG",
    "SECRET_KEY",
    "PORT",
    "DENO_KV_PATH",
    "DENO_KV_URL",
    "GITHUB_EVENT_PATH",
    "GITHUB_REPOSITORY",
    "GITHUB_EVENT_NAME",
    "GITHUB_ACTOR",
    "GITHUB_SHA",
    "GITHUB_REF",
  ];

  for (const key of requiredKeys) {
    assert(
      content.includes(key),
      `.env.example should contain environment key: ${key}`,
    );
  }
});
