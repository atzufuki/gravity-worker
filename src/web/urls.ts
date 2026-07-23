/**
 * Herkules Web Application URL Configuration
 *
 * Django-style URL routing for Herkules web & relay endpoints.
 *
 * @module web/urls
 */

import { path } from "@alexi/urls";
import { healthView, tokenRelayView, tunnelView } from "@web/views.ts";

export const urlpatterns = [
  path("health/", healthView),
  path("health", healthView),
  path("api/token/", tokenRelayView),
  path("api/token", tokenRelayView),
  path("ws/<str:owner>/<str:repo>", tunnelView),
  path("ws/<str:owner>/<str:repo>/", tunnelView),
  path("tunnel/<str:owner>/<str:repo>", tunnelView),
  path("tunnel/<str:owner>/<str:repo>/", tunnelView),
  path("tunnel/<str:owner>/<str:repo>/<path:extra>", tunnelView),
];
