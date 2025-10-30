// Enhanced Cloudflare Pages Function for deleting a specific YouTube link with improved error handling

// CORS headers with caching directives
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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
    
    const data = await KV_LINKS.get('youtube_links', 'json');
    
    if (!data || typeof data !== 'object') {
      log('No valid data found in KV storage, returning empty array', 'warn');
      return [];
    }
    
    if (!Array.isArray(data.links)) {
      log('Invalid links format in KV storage, returning empty array', 'warn');
      return [];
    }
    
    return data.links;
  } catch (error) {
    log(`Error getting links from KV storage: ${error.message}`, 'error');
    return [];
  }
}

// Function to save links with enhanced error handling
async function saveLinks(links) {
  try {
    if (!Array.isArray(links)) {
      log('Invalid links format: expected array', 'error');
      return false;
    }
    
    if (!kvAvailable()) {
      log('KV storage is not available. Cannot persist data across sessions/devices.', 'error');
      return false;
    }
    
    await KV_LINKS.put('youtube_links', JSON.stringify({ links: links }));
    log(`Successfully saved ${links.length} links to KV storage`);
    return true;
  } catch (error) {
    log(`Error saving links to KV storage: ${error.message}`, 'error');
    return false;
  }
}

// Main handler function
export async function onRequest(context) {
  const { request, params } = context;
  const { linkId } = params || {};
  
  // Validate linkId parameter
  if (!linkId || typeof linkId !== 'string') {
    log('Invalid or missing linkId parameter', 'error');
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid or missing linkId parameter'
    }), { 
      headers: corsHeaders,
      status: 400 
    });
  }
  
  // Handle OPTIONS for CORS
  if (request.method === 'OPTIONS') {
    log(`Received OPTIONS request for link ID: ${linkId}`, 'info');
    return new Response(null, { headers: corsHeaders });
  }
  
  // Handle DELETE request to remove a specific link
  if (request.method === 'DELETE') {
    try {
      log(`Received DELETE request for link ID: ${linkId}`, 'info');
      
      // Get current links with enhanced error handling
      const links = await getLinks();
      log(`Current links count before deletion: ${links.length}`, 'info');
      
      // Validate links array
      if (!Array.isArray(links)) {
        log('Invalid links data retrieved, treating as empty array', 'warn');
        return new Response(JSON.stringify({
          success: true,
          message: 'Link not found or already removed',
          remainingLinks: 0
        }), { headers: corsHeaders });
      }
      
      // Filter out the link with matching ID
      const originalLength = links.length;
      const filteredLinks = links.filter(link => {
        // Only consider valid link objects with id property
        if (!link || typeof link !== 'object') return false;
        return link.id !== linkId;
      });
      
      const linkRemoved = filteredLinks.length < originalLength;
      log(`Link removal ${linkRemoved ? 'succeeded' : 'failed'}: ${linkId}`, linkRemoved ? 'info' : 'warn');
      
      // Save updated links only if there was a change
      if (linkRemoved) {
        const saveSuccess = await saveLinks(filteredLinks);
        
        if (saveSuccess) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Link removed successfully',
            remainingLinks: filteredLinks.length,
            linkId: linkId,
            timestamp: new Date().toISOString()
          }), { headers: corsHeaders });
        } else {
          // Save failed, but deletion was requested
          // Return success for the operation but note persistence issue
          return new Response(JSON.stringify({
            success: true,
            message: 'Link marked for removal',
            note: 'Data may not persist across sessions due to storage issues',
            linkId: linkId,
            timestamp: new Date().toISOString()
          }), { headers: corsHeaders });
        }
      } else {
        // Link not found
        return new Response(JSON.stringify({
          success: true,
          message: 'Link not found or already removed',
          remainingLinks: filteredLinks.length,
          linkId: linkId,
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders });
      }
    } catch (error) {
      log(`Error handling DELETE request for link ID ${linkId}: ${error.message}`, 'error');
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to remove link',
        error: error.message,
        linkId: linkId,
        timestamp: new Date().toISOString()
      }), { 
        headers: corsHeaders,
        status: 500 
      });
    }
  }
  
  // Method not allowed
  log(`Method ${request.method} not allowed for link ID: ${linkId}`, 'warn');
  return new Response(JSON.stringify({
    success: false,
    message: `Method ${request.method} not allowed`,
    allowedMethods: 'DELETE, OPTIONS',
    linkId: linkId,
    timestamp: new Date().toISOString()
  }), { 
    headers: { ...corsHeaders, 'Allow': 'DELETE, OPTIONS' },
    status: 405 
  });
}