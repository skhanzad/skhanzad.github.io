/** Public newsletter / Substack */
export const SUBSTACK_URL = "https://sourenakhanzadeh.substack.com";

/** Substack signup embed (iframe `src`) */
export const SUBSTACK_EMBED_URL = `${SUBSTACK_URL}/embed`;

export const SITE_NAME = "Sourena Khanzadeh";

/**
 * Canonical site URL for RSS, sitemap, and Open Graph.
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. Netlify env). Netlify also sets `URL` during build.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const netlify = process.env.URL?.trim();
  if (netlify) return netlify.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "https://skhanzad.github.io";
}

/** Default OG / social preview image (under `public/`) */
export const DEFAULT_OG_IMAGE_PATH = "/me-cartoonify.png";
