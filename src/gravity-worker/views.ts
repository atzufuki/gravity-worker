/**
 * GravityWorker Views
 *
 * @module gravity-worker/views
 */

/** Health check endpoint — returns JSON status. */
export function healthView(_request: Request): Response {
  return Response.json({
    status: "ok",
    app: "gravity-worker",
    timestamp: new Date().toISOString(),
  });
}

