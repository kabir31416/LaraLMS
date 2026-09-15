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
  social: {
    facebook: { handle: "@kabir31416", url: "https://www.facebook.com/kabir31416" },
    github: { handle: "@kabir31416", url: "https://github.com/kabir31416" },
    linkedin: { handle: "@kabir31416", url: "https://www.linkedin.com/in/kabir31416" },
  },
} as const;
