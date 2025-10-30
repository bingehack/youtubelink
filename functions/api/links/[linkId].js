// Cloudflare Pages Functions API handler for deleting a specific YouTube link
// This file handles DELETE requests to /api/links/{linkId}

// Define KV key
const KV_KEY = 'youtube_links';

// Default CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
};

// Handle OPTIONS requests for CORS preflight
function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders,
  });
}

/**
 * Delete a specific link by ID
 */
async function deleteLink(linkId) {
  try {
    // Check if KV_LINKS exists
    if (typeof KV_LINKS === 'undefined') {
      console.error('KV_LINKS is not defined, cannot delete link');
      throw new Error('KV storage is not available');
    }
    
    // Get existing links
    const existingData = await KV_LINKS.get(KV_KEY, 'json') || { links: [] };
    const existingLinks = existingData.links || [];
    
    // Filter out the link to delete
    const updatedLinks = existingLinks.filter(link => link.url !== linkId);
    
    // Check if any link was deleted
    const wasDeleted = updatedLinks.length !== existingLinks.length;
    
    // Save updated links
    await KV_LINKS.put(KV_KEY, JSON.stringify({ links: updatedLinks }));
    
    return {
      message: wasDeleted ? 'Link deleted successfully' : 'Link not found',
      deleted: wasDeleted,
      totalCount: updatedLinks.length
    };
  } catch (error) {
    console.error('Error deleting link:', error);
    throw error;
  }
}

// Main function handler
export async function onRequest(context) {
  const { request, params } = context;
  const { linkId } = params;
  
  // Handle OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  // Only handle DELETE requests for this endpoint
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Allow': 'DELETE, OPTIONS',
      },
    });
  }
  
  try {
    // Validate linkId is provided
    if (!linkId) {
      return new Response(JSON.stringify({ error: 'Link ID is required' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Delete the link
    const result = await deleteLink(linkId);
    
    // Return appropriate status based on deletion result
    const status = result.deleted ? 200 : 404;
    return new Response(JSON.stringify(result), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
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