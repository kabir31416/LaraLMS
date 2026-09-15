/**
 * Fixed, product-level developer/branding info shown at the bottom of the
 * Admin sidebar (AppSidebar.tsx). Deliberately NOT part of Institution
 * Settings and NOT read from any API/database — a normal Admin can change
 * every field in Settings, but this is app branding, not tenant
 * configuration, so it lives only here in source. Changing it requires a
 * code change, not an Admin-UI action.
 */
export const DEVELOPER_INFO = {
  productName: "LaraLMS",
  developerName: "Sahariar Kabir",
  phone: "01999667701",
} as const;
