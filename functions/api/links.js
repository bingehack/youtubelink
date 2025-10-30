// Enhanced Cloudflare Pages Function for YouTube Link Manager with improved data persistence

// CORS headers with caching directives
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, max-age=0'
};

// Check if KV storage is available and properly configured
function kvAvailable() {
  return typeof KV_LINKS !== 'undefined';
}

// Log function that works in both browser and Cloudflare environment
function log(message, level = 'info') {
  // In Cloudflare Pages Functions environment
  if (typeof console !== 'undefined') {
    if (level === 'error') console.error(message);
    else if (level === 'warn') console.warn(message);
    else console.log(message);
  }
}

// Function to get links with enhanced error handling
async function getLinks() {
  try {
    if (!kvAvailable()) {
      log('KV storage is not available. Check if KV namespace is properly bound.', 'warn');
      return [];
    }
    
    // Try to get links from KV storage
    const data = await KV_LINKS.get('youtube_links', 'json');
    
    // Validate and normalize data format
    if (!data || typeof data !== 'object') {
      log('No valid data found in KV storage, returning empty array', 'warn');
      return [];
    }
    
    if (!Array.isArray(data.links)) {
      log('Invalid links format in KV storage, returning empty array', 'warn');
      return [];
    }
    
    log(`Successfully loaded ${data.links.length} links from KV storage`);
    return data.links;
  } catch (error) {
    log(`Error getting links from KV storage: ${error.message}`, 'error');
    return [];
  }
}

// Function to save links with enhanced error handling and validation
async function saveLinks(links) {
  try {
    // Input validation
    if (!Array.isArray(links)) {
      log('Invalid links format: expected array', 'error');
      return { success: false, message: 'Invalid links format', error: 'Expected array' };
    }
    
    // Validate each link object
    const validLinks = links.filter(link => {
      const isValid = link && typeof link === 'object' && typeof link.url === 'string';
      if (!isValid) {
        log(`Invalid link object: ${JSON.stringify(link)}`, 'warn');
      }
      return isValid;
    });
    
    // Check if KV is available
    if (!kvAvailable()) {
      log('KV storage is not available. Cannot persist data across sessions/devices.', 'error');
      return { 
        success: false, 
        message: 'KV storage not available', 
        error: 'KV_LINKS namespace not bound',
        note: 'Data will only be stored in browser localStorage, not persisted across devices'
      };
    }
    
    // Save to KV storage with proper error handling
    await KV_LINKS.put('youtube_links', JSON.stringify({ links: validLinks }));
    log(`Successfully saved ${validLinks.length} links to KV storage`);
    return { 
      success: true, 
      message: 'Links saved successfully', 
      count: validLinks.length,
      totalLinks: validLinks.length
    };
  } catch (error) {
    log(`Error saving links to KV storage: ${error.message}`, 'error');
    return { 
      success: false, 
      message: 'Failed to save links to server', 
      error: error.message,
      note: 'Data will only be stored in browser localStorage, not persisted across devices'
    };
  }
}

// Main handler function
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Handle OPTIONS for CORS
  if (request.method === 'OPTIONS') {
    log(`Received OPTIONS request to ${url.pathname}`, 'info');
    return new Response('OK', { headers: corsHeaders });
  }
  
  try {
    // Handle GET request
    if (request.method === 'GET') {
      log(`Received GET request to fetch links`, 'info');
      const links = await getLinks();
      return new Response(JSON.stringify({
        success: true,
        links: links,
        count: links.length,
        message: links.length > 0 ? `Retrieved ${links.length} links` : 'No links found',
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders });
    }
    
    // Handle POST request
    if (request.method === 'POST') {
      log(`Received POST request to save links`, 'info');
      
      let body;
      try {
        body = await request.json();
      } catch (parseError) {
        log(`Failed to parse JSON request body: ${parseError.message}`, 'error');
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid JSON format',
          error: 'Malformed JSON request body'
        }), {
          headers: corsHeaders,
          status: 400
        });
      }
      
      const result = await saveLinks(body.links || []);
      return new Response(JSON.stringify({
        ...result,
        timestamp: new Date().toISOString()
      }), {
        headers: corsHeaders,
        status: result.success ? 200 : 400
      });
    }
    
    // Handle DELETE request
    if (request.method === 'DELETE') {
      log(`Received DELETE request to clear all links`, 'info');
      
      const result = await saveLinks([]);
      
      if (result.success) {
        return new Response(JSON.stringify({
          success: true,
          message: 'All links cleared successfully',
          count: 0,
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({
          ...result,
          message: result.message || 'Failed to clear links',
          timestamp: new Date().toISOString()
        }), {
          headers: corsHeaders,
          status: 500
        });
      }
    }
    
    // Method not allowed
    log(`Method ${request.method} not allowed for ${url.pathname}`, 'warn');
    return new Response(JSON.stringify({
      success: false,
      message: `Method ${request.method} not allowed`,
      allowedMethods: 'GET, POST, DELETE, OPTIONS'
    }), {
      headers: corsHeaders,
      status: 405
    });
  } catch (e) {
    log(`Unexpected error in onRequest: ${e.message}`, 'error');
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: e.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}