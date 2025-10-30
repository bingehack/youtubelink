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
 * Delete a specific link by ID
 */
async function deleteLink(linkId) {
  // Validate linkId parameter
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('Invalid link ID parameter');
  }
  
  try {
    const envStatus = checkEnvironment();
    
    // Check if KV_LINKS exists
    if (!envStatus.kvLinksDefined) {
      console.error('KV_LINKS is not defined, cannot delete link');
      // Return success with warning instead of throwing error
      return {
        message: 'Warning: Cannot delete link (KV_LINKS not available)',
        deleted: false,
        totalCount: 0,
        warning: 'KV storage not configured properly'
      };
    }
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('KV operation timeout')), 5000);
    });
    
    // Get existing links with timeout protection
    const existingData = await Promise.race([
      KV_LINKS.get(KV_KEY, 'json'),
      timeoutPromise
    ]) || { links: [] };
    
    const existingLinks = existingData.links || [];
    
    // Filter out the link to delete
    const updatedLinks = existingLinks.filter(link => link.url !== linkId);
    
    // Check if any link was deleted
    const wasDeleted = updatedLinks.length !== existingLinks.length;
    
    // Save updated links with timeout protection
    await Promise.race([
      KV_LINKS.put(KV_KEY, JSON.stringify({ links: updatedLinks })),
      timeoutPromise
    ]);
    
    console.log('Link deletion result:', {
      linkId,
      deleted: wasDeleted,
      totalCount: updatedLinks.length
    });
    
    return {
      message: wasDeleted ? 'Link deleted successfully' : 'Link not found',
      deleted: wasDeleted,
      totalCount: updatedLinks.length
    };
  } catch (error) {
    console.error('Error deleting link:', {
      linkId,
      message: error.message,
      stack: error.stack
    });
    
    // Return a success response with warning instead of throwing error
    return {
      message: 'Warning: Could not delete link due to an error',
      error: error.message,
      deleted: false,
      totalCount: 0
    };
  }
}

// Main function handler
export async function onRequest(context) {
  const { request, params, env } = context;
  const { linkId } = params || {};
  
  // Log request details for debugging
  console.log('API Request received for link deletion:', {
    method: request.method,
    url: request.url,
    linkId,
    contextEnv: Object.keys(env || {}).filter(key => !key.startsWith('__'))
  });
  
  // Handle OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return handleOptions(request);
  }
  
  // Only handle DELETE requests for this endpoint
  if (request.method !== 'DELETE') {
    console.warn(`Method not allowed: ${request.method}`);
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
    if (!linkId || typeof linkId !== 'string') {
      console.error('Invalid or missing linkId parameter:', linkId);
      return new Response(JSON.stringify({ error: 'Link ID is required and must be a string' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Delete the link
    console.log('Attempting to delete link:', linkId);
    const result = await deleteLink(linkId);
    
    // Return appropriate status based on deletion result
    // Use 200 for all responses to prevent worker crashes
    const status = result.deleted ? 200 : 404;
    return new Response(JSON.stringify(result), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Detailed error logging
    console.error('Critical API Error during link deletion:', {
      linkId,
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