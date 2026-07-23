import { neon } from "@neondatabase/serverless";

// Returns a tagged-template SQL client, or null when DATABASE_URL isn't set
// so the app still runs in live-only mode without a database.
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export const CATEGORIES = ["economics", "crypto", "politics", "sports"];
