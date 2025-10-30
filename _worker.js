/**
 * Cloudflare Pages Functions 入口点
 * 用于处理API请求并转发到KV存储处理逻辑
 */

// 导入KV命名空间（Cloudflare会自动注入）
// 注意：在Cloudflare控制台需配置KV命名空间绑定为KV_LINKS

// 定义KV键名
const KV_KEY = 'youtube_links';

/**
 * 处理所有传入请求
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 设置CORS头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  
  try {
    // API路由处理
    if (pathname.startsWith('/api/')) {
      return await handleApiRequest(request, pathname, corsHeaders);
    }
    
    // 其他请求由Cloudflare Pages默认处理
    return await fetch(request);
  } catch (error) {
    console.error('Worker Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * 处理API请求
 */
async function handleApiRequest(request, pathname, corsHeaders) {
  // 获取所有链接
  if (pathname === '/api/links' && request.method === 'GET') {
    const data = await getLinks();
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  // 添加/更新链接
  if (pathname === '/api/links' && request.method === 'POST') {
    const body = await request.json();
    const result = await saveLinks(body.links || []);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  // 删除特定链接
  if (pathname.startsWith('/api/links/') && request.method === 'DELETE') {
    const linkId = pathname.split('/').pop();
    const result = await deleteLink(linkId);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  // 清空所有链接
  if (pathname === '/api/links' && request.method === 'DELETE') {
    const result = await clearAllLinks();
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
  
  // 未找到匹配的API路由
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 从KV存储获取所有链接
 */
async function getLinks() {
  try {
    // 检查KV_LINKS是否存在（处理本地开发和部署配置问题）
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
 * 保存链接到KV存储
 */
async function saveLinks(newLinks) {
  if (!Array.isArray(newLinks)) {
    throw new Error('Links must be an array');
  }
  
  try {
    // 检查KV_LINKS是否存在
    if (typeof KV_LINKS === 'undefined') {
      console.error('KV_LINKS is not defined, cannot save links');
      throw new Error('KV storage is not available');
    }
    
    // 获取现有链接
    const existingData = await KV_LINKS.get(KV_KEY, 'json') || { links: [] };
    const existingLinks = existingData.links || [];
    
    // 去重（基于URL）
    const existingUrls = new Set(existingLinks.map(link => link.url));
    const uniqueNewLinks = newLinks.filter(link => !existingUrls.has(link.url));
    
    // 合并链接
    const updatedLinks = [...existingLinks, ...uniqueNewLinks];
    
    // 保存到KV存储
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
 * 删除特定链接
 */
async function deleteLink(linkId) {
  try {
    // 检查KV_LINKS是否存在
    if (typeof KV_LINKS === 'undefined') {
      console.error('KV_LINKS is not defined, cannot delete link');
      throw new Error('KV storage is not available');
    }
    
    // 获取现有链接
    const existingData = await KV_LINKS.get(KV_KEY, 'json') || { links: [] };
    const existingLinks = existingData.links || [];
    
    // 过滤掉要删除的链接
    const updatedLinks = existingLinks.filter(link => link.id !== linkId);
    
    // 保存更新后的链接
    await KV_LINKS.put(KV_KEY, JSON.stringify({ links: updatedLinks }));
    
    return {
      message: 'Link deleted successfully',
      totalCount: updatedLinks.length
    };
  } catch (error) {
    console.error('Error deleting link:', error);
    throw error;
  }
}

/**
 * 清空所有链接
 */
async function clearAllLinks() {
  try {
    // 检查KV_LINKS是否存在
    if (typeof KV_LINKS === 'undefined') {
      console.error('KV_LINKS is not defined, cannot clear links');
      throw new Error('KV storage is not available');
    }
    
    await KV_LINKS.put(KV_KEY, JSON.stringify({ links: [] }));
    return { message: 'All links cleared successfully' };
  } catch (error) {
    console.error('Error clearing links:', error);
    throw error;
  }
}

// 导出Worker处理函数
export default {
  fetch: handleRequest
};