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
    // Check if KV_LINKS exists (for local development and deployment issues)
    if (typeof KV_LINKS === 'undefined') {
      console.warn('KV_LINKS is not defined, returning empty links array');
      return [];
    }
    const data = await KV_LINKS.get(KV_KEY, 'json');
    return data?.links || [];
  } catch (error) {
    console.error('Error getting links:', error);
    return [];
  }
}

/**
 * Save links to KV storage
 */
async function saveLinks(newLinks) {
  if (!Array.isArray(newLinks)) {
    throw new Error('Links must be an array');
  }
  
  try {
    // Check if KV_LINKS exists
    if (typeof KV_LINKS === 'undefined') {
      console.error('KV_LINKS is not defined, cannot save links');
      throw new Error('KV storage is not available');
    }
    
    // Get existing links
    const existingData = await KV_LINKS.get(KV_KEY, 'json') || { links: [] };
    const existingLinks = existingData.links || [];
    
    // Deduplicate based on URL
    const existingUrls = new Set(existingLinks.map(link => link.url));
    const uniqueNewLinks = newLinks.filter(link => !existingUrls.has(link.url));
    
    // Merge links
    const updatedLinks = [...existingLinks, ...uniqueNewLinks];
    
    // Save to KV storage
    await KV_LINKS.put(KV_KEY, JSON.stringify({ links: updatedLinks }));
    
    return {
      message: 'Links added successfully',
      addedCount: uniqueNewLinks.length,
      totalCount: updatedLinks.length
    };
  } catch (error) {
    console.error('Error saving links:', error);
    throw error;
  }
}

/**
 * Clear all links from KV storage
 */
async function clearAllLinks() {
  try {
    // Check if KV_LINKS exists
    if (typeof KV_LINKS === 'undefined') {
      console.error('KV_LINKS is not defined, cannot clear links');
      throw new Error('KV storage is not available');
    }
    
    await KV_LINKS.put(KV_KEY, JSON.stringify({ links: [] }));
    
    return {
      message: 'All links cleared successfully',
      totalCount: 0
    };
  } catch (error) {
    console.error('Error clearing all links:', error);
    throw error;
  }
}

// Main function handler
export async function onRequest(context) {
  const { request } = context;
  
  // Handle OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  try {
    // Handle GET request - get all links
    if (request.method === 'GET') {
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
      const body = await request.json();
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
      const result = await clearAllLinks();
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Allow': 'GET, POST, DELETE, OPTIONS',
      },
    });
  } catch (error) {
    // Log error and return appropriate response
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}