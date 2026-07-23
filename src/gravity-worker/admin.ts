/**
 * GravityWorker Admin Configuration
 *
 * @module gravity-worker/admin
 */

import { AdminSite } from "@alexi/admin";

export const adminSite = new AdminSite({
  title: "GravityWorker Admin",
  urlPrefix: "/admin",
});

