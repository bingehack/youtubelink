// Simple Cloudflare Pages Function for YouTube Link Manager

// Minimal CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Simple check if KV is available
function kvAvailable() {
  return typeof KV_LINKS !== 'undefined';
}

// Simple function to get links
async function getLinksSimple() {
  try {
    if (!kvAvailable()) return [];
    const data = await KV_LINKS.get('youtube_links', 'json');
    return Array.isArray(data?.links) ? data.links : [];
  } catch (e) {
    return [];
  }
}

// Simple function to save links
async function saveLinksSimple(links) {
  try {
    if (!Array.isArray(links)) {
      return { success: false, message: 'Invalid links format' };
    }
    if (!kvAvailable()) {
      return { success: false, message: 'KV storage not available' };
    }
    await KV_LINKS.put('youtube_links', JSON.stringify({ links: links }));
    return { success: true, message: 'Links saved', count: links.length };
  } catch (e) {
    return { success: false, message: 'Failed to save links' };
  }
}

// Main handler function
export async function onRequest(context) {
  const { request } = context;
  
  // Handle OPTIONS for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Handle GET request
    if (request.method === 'GET') {
      const links = await getLinksSimple();
      return new Response(JSON.stringify(links), { headers: corsHeaders });
    }
    
    // Handle POST request
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: corsHeaders
        });
      }
      const result = await saveLinksSimple(body.links || []);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Handle DELETE request
    if (request.method === 'DELETE') {
      if (kvAvailable()) {
        try {
          await KV_LINKS.put('youtube_links', JSON.stringify({ links: [] }));
        } catch (e) {}
      }
      return new Response(JSON.stringify({ success: true, message: 'Links cleared' }), { 
        headers: corsHeaders 
      });
    }
    
    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Allow': 'GET, POST, DELETE, OPTIONS' }
    });
  } catch (e) {
    // Simple error response
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}