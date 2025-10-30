/**
 * YouTube Link Manager - Cloudflare Worker
 * Simplified version to handle static files and errors
 * API functionality is now handled by Cloudflare Pages Functions in the /functions directory
 */

/**
 * Main fetch handler - simplified version
 * This file is kept minimal to avoid conflicts with Cloudflare Pages Functions
 * which now handle all API requests through the /functions/api directory structure
 */
async function handleRequest(request) {
  try {
    // For all requests, return undefined to let Cloudflare handle them
    // This allows:
    // 1. Static files to be served normally
    // 2. API requests to be handled by Cloudflare Pages Functions in /functions/api
    return undefined;
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// Export the fetch handler
export default {
  fetch: handleRequest
};