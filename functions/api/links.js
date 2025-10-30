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
  const isAvailable = typeof KV_LINKS !== 'undefined';
  if (!isAvailable) {
    console.error('CRITICAL ERROR: KV_LINKS is undefined. This means Cloudflare KV storage is not properly bound.');
    console.error('Please ensure you have created a KV namespace named "YOUTUBE_LINK_KV" in your Cloudflare dashboard');
    console.error('and properly bound it to the variable name "KV_LINKS" in your Pages project settings.');
  }
  return isAvailable;
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
      const errorMsg = 'KV storage is not available. Cannot persist data across sessions/devices.';
      log(errorMsg, 'error');
      return { 
        success: false, 
        message: '数据持久化失败', 
        error: 'KV_LINKS命名空间未绑定',
        note: '数据只能存储在浏览器本地，页面刷新或更换浏览器后将丢失',
        critical: true,
        troubleshooting: '请确保在Cloudflare控制台中创建了名为"YOUTUBE_LINK_KV"的KV命名空间，并在Pages项目设置中正确绑定到变量名"KV_LINKS"'
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
        message: '保存链接到服务器失败', 
        error: error.message,
        note: '数据只能存储在浏览器本地，页面刷新或更换浏览器后将丢失',
        critical: true,
        troubleshooting: '可能是KV存储权限问题，请检查Cloudflare控制台中的KV命名空间设置'
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
      
      // 创建响应对象
      const responseData = {
        success: true,
        links: links,
        count: links.length,
        timestamp: new Date().toISOString()
      };
      
      // 如果KV存储不可用，添加警告信息
      if (!kvAvailable()) {
        responseData.warning = '数据持久化配置未完成：KV_LINKS命名空间未绑定。页面刷新或更换浏览器后数据可能丢失。';
        responseData.troubleshooting = '请确保在Cloudflare控制台中创建了名为"YOUTUBE_LINK_KV"的KV命名空间，并在Pages项目设置中正确绑定到变量名"KV_LINKS"。';
      }
      
      // 根据情况设置消息
      if (links.length > 0) {
        responseData.message = `Retrieved ${links.length} links`;
      } else if (!kvAvailable()) {
        responseData.message = '未找到链接 - 注意：数据持久化未配置，所有数据仅存储在本地浏览器中';
      } else {
        responseData.message = 'No links found';
      }
      
      return new Response(JSON.stringify(responseData), { headers: corsHeaders });
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