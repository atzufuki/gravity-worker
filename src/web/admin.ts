/**
 * Herkules Web App Admin Configuration
 *
 * @module web/admin
 */

import { AdminSite } from "@alexi/admin";

export const adminSite = new AdminSite({
  title: "Herkules Admin",
  urlPrefix: "/admin",
});
