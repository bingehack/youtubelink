/**
 * YouTube Link Manager - Cloudflare Worker
 * Enhanced error handling version
 */

/**
 * Main fetch handler with improved error handling
 */
async function handleRequest(request) {
  try {
    // Log request details for debugging
    console.log('Request received:', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    // For all requests, return undefined to let Cloudflare handle them
    // This allows:
    // 1. Static files to be served normally
    // 2. API requests to be handled by Cloudflare Pages Functions in /functions/api
    return undefined;
  } catch (error) {
    // Detailed error logging with stack trace
    console.error('Critical Worker error:', {
      message: error.message,
      stack: error.stack,
      errorObject: JSON.stringify(error)
    });
    
    // Return a clear error response
    return new Response(JSON.stringify({
      error: 'Worker Execution Error',
      message: 'An unexpected error occurred while processing your request.',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': '1101'
      },
    });
  }
}

/**
 * Add a global error handler to catch any unhandled exceptions
 */
addEventListener('error', (event) => {
  console.error('Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? {
      message: event.error.message,
      stack: event.error.stack
    } : null
  });
});

/**
 * Add a global unhandled rejection handler
 */
addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason ? {
      message: event.reason.message,
      stack: event.reason.stack
    } : event.reason
  });
});

// Export the fetch handler
export default {
  fetch: handleRequest
};