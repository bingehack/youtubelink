// Simple Cloudflare Pages Function for deleting a specific YouTube link

// Minimal CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Simple check if KV is available
function kvAvailable() {
  return typeof KV_LINKS !== 'undefined';
}

// Main handler function
export async function onRequest(context) {
  const { request, params } = context;
  const { linkId } = params || {};
  
  // Handle OPTIONS for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only handle DELETE requests
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Allow': 'DELETE, OPTIONS' }
    });
  }
  
  try {
    // Validate linkId
    if (!linkId || typeof linkId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid link ID' }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // If KV is available, try to delete the link
    if (kvAvailable()) {
      try {
        const data = await KV_LINKS.get('youtube_links', 'json');
        const existingLinks = Array.isArray(data?.links) ? data.links : [];
        const updatedLinks = existingLinks.filter(link => link.url !== linkId);
        const wasDeleted = updatedLinks.length !== existingLinks.length;
        
        await KV_LINKS.put('youtube_links', JSON.stringify({ links: updatedLinks }));
        
        return new Response(JSON.stringify({
          success: true,
          deleted: wasDeleted,
          message: wasDeleted ? 'Link deleted' : 'Link not found'
        }), { headers: corsHeaders });
      } catch (e) {
        // Return success response even if KV operation fails
        return new Response(JSON.stringify({
          success: false,
          deleted: false,
          message: 'Failed to process deletion'
        }), { headers: corsHeaders });
      }
    } else {
      // KV not available
      return new Response(JSON.stringify({
        success: false,
        deleted: false,
        message: 'Storage not available'
      }), { headers: corsHeaders });
    }
  } catch (e) {
    // Simple error response
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}