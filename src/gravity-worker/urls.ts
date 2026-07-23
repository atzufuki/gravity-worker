/**
 * GravityWorker URL Configuration
 *
 * @module gravity-worker/urls
 */

import { path } from "@alexi/urls";
import { healthView } from "@gravity-worker/views.ts";

// Main URL patterns
export const urlpatterns = [
  path("health/", healthView),
];
