/**
 * YouTube Link Manager - Minimal Cloudflare Worker
 * This is a very simple Worker that delegates to Cloudflare Pages
 */

// Simple fetch handler - avoids any complex operations that might throw
export default {
  fetch: () => {
    // For Pages projects with Functions, returning undefined
    // lets Cloudflare handle all requests appropriately
    // This includes static assets and Pages Functions in /functions
    return undefined;
  }
};