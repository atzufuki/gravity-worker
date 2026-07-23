/**
 * GravityWorker — HTTP Entry Point
 *
 * Production server entrypoint for Deno Deploy and `deno serve`.
 * Analogous to Django's wsgi.py — a thin shell that calls
 * getHttpApplication() and exports the result.
 *
 * Settings are loaded by the management command via --settings flag,
 * or configured via configureSettings() before this module is imported.
 *
 * Usage:
 *   deno serve -A --unstable-kv project/http.ts
 *   # or just deploy to Deno Deploy — it picks up the default export.
 *
 * @module http
 */

import { getHttpApplication } from "@alexi/core";

export default await getHttpApplication();
