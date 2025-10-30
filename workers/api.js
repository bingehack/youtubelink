/**
 * Cloudflare Workers API for YouTube Link Manager
 * This serves as the backend for the YouTube Link Manager application
 * running on Cloudflare Pages, using KV storage for data persistence.
 */

// 定义KV命名空间绑定（Cloudflare Workers会自动注入）
// 注意：实际部署时需要在Cloudflare控制台配置这些绑定
const LINKS_NAMESPACE = KV_LINKS;
const KV_KEY = 'youtube_links';

/**
 * 处理不同的API请求
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
    
    // 未找到匹配的路由
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('API Error:', error);
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
 * 从KV存储获取所有链接
 */
async function getLinks() {
  try {
    const data = await LINKS_NAMESPACE.get(KV_KEY, 'json');
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
    // 获取现有链接
    const existingData = await LINKS_NAMESPACE.get(KV_KEY, 'json') || { links: [] };
    const existingLinks = existingData.links || [];
    
    // 去重（基于URL）
    const existingUrls = new Set(existingLinks.map(link => link.url));
    const uniqueNewLinks = newLinks.filter(link => !existingUrls.has(link.url));
    
    // 合并链接
    const updatedLinks = [...existingLinks, ...uniqueNewLinks];
    
    // 保存到KV存储
    await LINKS_NAMESPACE.put(KV_KEY, JSON.stringify({ links: updatedLinks }));
    
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
    // 获取现有链接
    const existingData = await LINKS_NAMESPACE.get(KV_KEY, 'json') || { links: [] };
    const existingLinks = existingData.links || [];
    
    // 过滤掉要删除的链接
    const updatedLinks = existingLinks.filter(link => link.id !== linkId);
    
    // 保存更新后的链接
    await LINKS_NAMESPACE.put(KV_KEY, JSON.stringify({ links: updatedLinks }));
    
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
    await LINKS_NAMESPACE.put(KV_KEY, JSON.stringify({ links: [] }));
    return { message: 'All links cleared successfully' };
  } catch (error) {
    console.error('Error clearing links:', error);
    throw error;
  }
}

// 导出Worker处理函数
export default { fetch: handleRequest };