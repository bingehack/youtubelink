// Cloudflare Pages Functions API handler for YouTube Link Manager
// This file handles all API endpoints under /api/links

// Define KV key
const KV_KEY = 'youtube_links';

// Default CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
};

// Environment check utility
function checkEnvironment() {
  const envStatus = {
    kvLinksDefined: typeof KV_LINKS !== 'undefined',
    env: process.env.NODE_ENV || 'production',
  };
  console.log('Environment status:', envStatus);
  return envStatus;
}

// Handle OPTIONS requests for CORS preflight
function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders,
  });
}

/**
 * Get all links from KV storage
 */
async function getLinks() {
  try {
    const envStatus = checkEnvironment();
    
    // Check if KV_LINKS exists (for local development and deployment issues)
    if (!envStatus.kvLinksDefined) {
      console.warn('KV_LINKS is not defined, returning empty links array');
      // Return empty array instead of throwing error to prevent worker crashes
      return [];
    }
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('KV operation timeout')), 5000);
    });
    
    const data = await Promise.race([
      KV_LINKS.get(KV_KEY, 'json'),
      timeoutPromise
    ]);
    
    console.log('Retrieved links data:', { hasData: !!data, linksCount: data?.links?.length || 0 });
    return data?.links || [];
  } catch (error) {
    console.error('Error getting links:', {
      message: error.message,
      stack: error.stack
    });
    // Always return empty array on error to prevent worker crashes
    return [];
  }
}

/**
 * Save links to KV storage
 */
async function saveLinks(newLinks) {
  // Input validation
  if (!Array.isArray(newLinks)) {
    throw new Error('Links must be an array');
  }
  
  // Validate link objects
  for (const link of newLinks) {
    if (!link || typeof link !== 'object' || !link.url) {
      throw new Error('Each link must be an object with a URL property');
    }
  }
  
  try {
    const envStatus = checkEnvironment();
    
    // Check if KV_LINKS exists
    if (!envStatus.kvLinksDefined) {
      console.error('KV_LINKS is not defined, cannot save links');
      // Return success with warning instead of throwing error
      return {
        message: 'Warning: Links could not be saved to KV storage (KV_LINKS not available)',
        addedCount: 0,
        totalCount: newLinks.length,
        warning: 'KV storage not configured properly'
      };
    }
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('KV operation timeout')), 10000);
    });
    
    // Get existing links with timeout protection
    const existingData = await Promise.race([
      KV_LINKS.get(KV_KEY, 'json'),
      timeoutPromise
    ]) || { links: [] };
    
    const existingLinks = existingData.links || [];
    
    // Deduplicate based on URL
    const existingUrls = new Set(existingLinks.map(link => link.url));
    const uniqueNewLinks = newLinks.filter(link => !existingUrls.has(link.url));
    
    // Merge links
    const updatedLinks = [...existingLinks, ...uniqueNewLinks];
    
    // Save to KV storage with timeout protection
    await Promise.race([
      KV_LINKS.put(KV_KEY, JSON.stringify({ links: updatedLinks })),
      timeoutPromise
    ]);
    
    console.log('Links saved successfully:', {
      addedCount: uniqueNewLinks.length,
      totalCount: updatedLinks.length
    });
    
    return {
      message: 'Links added successfully',
      addedCount: uniqueNewLinks.length,
      totalCount: updatedLinks.length
    };
  } catch (error) {
    console.error('Error saving links:', {
      message: error.message,
      stack: error.stack,
      attemptedLinksCount: newLinks.length
    });
    
    // Return a success response with warning instead of throwing error
    // This prevents the worker from crashing while informing the client
    return {
      message: 'Warning: Some links may not have been saved due to an error',
      error: error.message,
      addedCount: 0,
      totalCount: newLinks.length,
      isPartialSuccess: false
    };
  }
}

/**
 * Clear all links from KV storage
 */
async function clearAllLinks() {
  try {
    const envStatus = checkEnvironment();
    
    // Check if KV_LINKS exists
    if (!envStatus.kvLinksDefined) {
      console.error('KV_LINKS is not defined, cannot clear links');
      // Return success with warning instead of throwing error
      return {
        message: 'Warning: Cannot clear links (KV_LINKS not available)',
        totalCount: 0,
        warning: 'KV storage not configured properly'
      };
    }
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('KV operation timeout')), 5000);
    });
    
    // Clear links with timeout protection
    await Promise.race([
      KV_LINKS.put(KV_KEY, JSON.stringify({ links: [] })),
      timeoutPromise
    ]);
    
    console.log('Links cleared successfully');
    
    return {
      message: 'All links cleared successfully',
      totalCount: 0
    };
  } catch (error) {
    console.error('Error clearing all links:', {
      message: error.message,
      stack: error.stack
    });
    
    // Return a success response with warning instead of throwing error
    return {
      message: 'Warning: Could not clear links due to an error',
      error: error.message,
      totalCount: 0
    };
  }
}

// Main function handler
export async function onRequest(context) {
  const { request, env } = context;
  
  // Log request details for debugging
  console.log('API Request received:', {
    method: request.method,
    url: request.url,
    contextEnv: Object.keys(env || {}).filter(key => !key.startsWith('__'))
  });
  
  // Handle OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return handleOptions(request);
  }
  
  try {
    // Handle GET request - get all links
    if (request.method === 'GET') {
      console.log('Handling GET request for links');
      const data = await getLinks();
      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Handle POST request - add/update links
    if (request.method === 'POST') {
      console.log('Handling POST request for links');
      
      // Safely parse JSON with error handling
      let body;
      try {
        body = await request.json();
      } catch (jsonError) {
        console.error('Invalid JSON in request body:', jsonError.message);
        return new Response(JSON.stringify({ 
          error: 'Bad Request',
          message: 'Invalid JSON format in request body'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
      
      const result = await saveLinks(body.links || []);
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Handle DELETE request - clear all links
    if (request.method === 'DELETE') {
      console.log('Handling DELETE request for links');
      const result = await clearAllLinks();
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Method not allowed
    console.warn(`Method not allowed: ${request.method}`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Allow': 'GET, POST, DELETE, OPTIONS',
      },
    });
  } catch (error) {
    // Detailed error logging
    console.error('Critical API Error:', {
      message: error.message,
      stack: error.stack,
      requestMethod: request.method,
      requestUrl: request.url
    });
    
    // Return a safe error response without exposing sensitive information
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request',
      referenceId: Date.now().toString(36)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Error-Reference': Date.now().toString(36)
      },
    });
  }
}