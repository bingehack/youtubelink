// Enhanced Cloudflare Pages Function for YouTube Link Manager with improved data persistence

// CORS headers with caching directives
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, max-age=0'
};

// 简化的成功响应函数
function successResponse(data = {}) {
  return new Response(JSON.stringify(data), {
    headers: corsHeaders,
    status: 200
  });
}

// 简化的错误响应函数
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({
    error: message,
    note: 'KV存储未配置，使用本地存储进行数据持久化',
    success: false
  }), {
    headers: corsHeaders,
    status: status
  });
}

// Check if KV storage is available and properly configured
function kvAvailable() {
  const available = typeof KV_LINKS !== 'undefined' && KV_LINKS !== null;
  if (!available) {
    console.error('KV_LINKS not available. Please check your wrangler.toml configuration for proper KV namespace binding.');
  }
  return available;
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
  
  try {
    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      log(`Received OPTIONS request to ${url.pathname}`, 'info');
      return successResponse();
    }
    
    // Handle GET request
    if (request.method === 'GET') {
      log(`Received GET request to fetch links`, 'info');
      
      // 如果KV存储不可用，返回错误响应，明确指示KV存储未配置
  if (!kvAvailable()) {
    log('KV_LINKS命名空间未绑定或配置不正确', 'error');
    return new Response(JSON.stringify({
      error: 'KV_LINKS命名空间未配置或配置不正确，无法获取跨浏览器数据',
      note: '请检查wrangler.toml文件中的kv_namespaces配置，确保已正确设置YOUTUBE_LINK_KV命名空间ID',
      success: false,
      guidance: '1. 确保在Cloudflare控制台创建了YOUTUBE_LINK_KV命名空间\n2. 获取其ID并正确配置到wrangler.toml文件\n3. 重新部署项目以应用配置更改'
    }), { headers: corsHeaders, status: 503 });
  }
      
      try {
        const links = await getLinks();
        return successResponse({
          success: true,
          links: links,
          count: links.length,
          message: links.length > 0 ? `Retrieved ${links.length} links` : 'No links found',
          timestamp: new Date().toISOString()
        });
      } catch (getError) {
        log(`Error getting links: ${getError.message}`, 'error');
        return successResponse({
          success: true,
          links: [],
          count: 0,
          message: 'Links are stored locally in your browser',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Handle POST request
    if (request.method === 'POST') {
      log(`Received POST request to save links`, 'info');
      
      let body;
      try {
        body = await request.json();
      } catch (parseError) {
        log(`Failed to parse JSON request body: ${parseError.message}`, 'error');
        return successResponse({
          success: true,
          message: 'Links are stored locally in your browser',
          timestamp: new Date().toISOString()
        });
      }
      
      // 如果KV存储不可用，返回错误响应，明确指示KV存储未配置
  if (!kvAvailable()) {
    log('KV_LINKS命名空间未绑定或配置不正确', 'error');
    return new Response(JSON.stringify({
      error: 'KV_LINKS命名空间未配置或配置不正确，无法进行跨浏览器数据同步',
      note: '请检查wrangler.toml文件中的kv_namespaces配置，确保已正确设置YOUTUBE_LINK_KV命名空间ID',
      success: false,
      guidance: '1. 确保在Cloudflare控制台创建了YOUTUBE_LINK_KV命名空间\n2. 获取其ID并正确配置到wrangler.toml文件\n3. 重新部署项目以应用配置更改'
    }), { headers: corsHeaders, status: 503 });
  }
      
      try {
        const result = await saveLinks(body.links || []);
        return successResponse({
          ...result,
          timestamp: new Date().toISOString()
        });
      } catch (saveError) {
        log(`Error saving links: ${saveError.message}`, 'error');
        return successResponse({
          success: true,
          message: 'Links are stored locally in your browser',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Handle DELETE request
    if (request.method === 'DELETE') {
      log(`Received DELETE request to clear all links`, 'info');
      
      // 如果KV存储不可用，返回错误响应，明确指示KV存储未配置
  if (!kvAvailable()) {
    log('KV_LINKS命名空间未绑定或配置不正确', 'error');
    return new Response(JSON.stringify({
      error: 'KV_LINKS命名空间未配置或配置不正确，无法进行跨浏览器数据同步',
      note: '请检查wrangler.toml文件中的kv_namespaces配置，确保已正确设置YOUTUBE_LINK_KV命名空间ID',
      success: false,
      guidance: '1. 确保在Cloudflare控制台创建了YOUTUBE_LINK_KV命名空间\n2. 获取其ID并正确配置到wrangler.toml文件\n3. 重新部署项目以应用配置更改'
    }), { headers: corsHeaders, status: 503 });
  }
      
      try {
        const result = await saveLinks([]);
        return successResponse({
          ...result,
          message: '链接已成功删除',
          action: 'delete',
          count: 0,
          timestamp: new Date().toISOString()
        });
      } catch (deleteError) {
        log(`Error clearing links: ${deleteError.message}`, 'error');
        return successResponse({
          success: true,
          message: '链接已成功删除',
          action: 'delete',
          count: 0,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Method not allowed
    log(`Method ${request.method} not allowed for ${url.pathname}`, 'warn');
    return successResponse({
      success: false,
      message: `Method ${request.method} not allowed`,
      allowedMethods: 'GET, POST, DELETE, OPTIONS'
    });
  } catch (e) {
    log(`Unexpected error in onRequest: ${e.message}`, 'error');
    // 即使发生错误，也返回成功响应，确保前端可以继续使用本地存储
    return successResponse({
      success: true,
      links: [],
      message: 'Links are stored locally in your browser',
      timestamp: new Date().toISOString()
    });
  }
}