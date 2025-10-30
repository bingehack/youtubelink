/**
 * Cloudflare Pages 适配层
 * 提供统一的API接口，根据环境自动切换数据存储方式
 */

// 检测是否在Cloudflare Pages环境中
const isCloudflarePages = (typeof process !== 'undefined' && process.env && process.env.CLOUDFLARE_PAGES === 'true') || 
                        window.location.hostname.includes('.pages.dev');

// 根据环境动态配置API基础URL
const API_BASE_URL = isCloudflarePages ? '/api' : 
                     (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') ? '/api' : 
                     'http://localhost:3000/api';

/**
 * 从服务器加载链接的统一接口
 * 自动适配不同环境
 */
async function loadLinksFromServer() {
  try {
    // 构建完整的API URL
    const apiUrl = `${API_BASE_URL}/links`;
    console.log(`Loading links from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const links = await response.json();
      console.log('Links loaded successfully:', links);
      return links;
    } else {
      // 获取错误详情
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: '无法解析错误响应' };
      }
      
      console.error('Failed to load links from server:', response.status, errorData);
      
      // 如果是503错误，很可能是KV存储未配置
      if (response.status === 503 && errorData.error && errorData.error.includes('KV_LINKS')) {
        console.error('KV存储配置问题:', errorData.error);
        // 抛出特定错误，让调用者知道这是KV存储问题
        throw new Error(`KV存储配置错误: ${errorData.error}`);
      }
      
      // 如果是在开发环境，尝试切换到本地开发服务器
      if (!isCloudflarePages && API_BASE_URL !== 'http://localhost:3000/api') {
        console.log('Trying fallback to localhost:3000');
        const fallbackResponse = await fetch('http://localhost:3000/api/links', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (fallbackResponse.ok) {
          const links = await fallbackResponse.json();
          console.log('Fallback to localhost successful');
          return links;
        }
      }
      
      // 返回错误对象而不是null，让调用者能够区分不同类型的失败
      return { success: false, error: errorData.error || `服务器响应错误: ${response.status}` };
    }
  } catch (error) {
    console.error('Error connecting to server:', error);
    throw error; // 重新抛出错误，让调用者处理
  }
}

/**
 * 保存链接到服务器的统一接口
 * 自动适配不同环境
 */
async function saveLinksToServer(links) {
  try {
    // 构建完整的API URL
    const apiUrl = `${API_BASE_URL}/links`;
    console.log(`Saving links to: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ links })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Links saved to server:', result);
      return true;
    } else {
      // 获取错误详情
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: '无法解析错误响应' };
      }
      
      console.error('Failed to save links to server:', response.status, errorData);
      
      // 如果是503错误，很可能是KV存储未配置
      if (response.status === 503 && errorData.error && errorData.error.includes('KV_LINKS')) {
        console.error('KV存储配置问题:', errorData.error);
        // 抛出特定错误，让调用者知道这是KV存储问题
        throw new Error(`KV存储配置错误: ${errorData.error}`);
      }
      
      // 如果是在开发环境，尝试切换到本地开发服务器
      if (!isCloudflarePages && API_BASE_URL !== 'http://localhost:3000/api') {
        console.log('Trying fallback to localhost:3000');
        const fallbackResponse = await fetch('http://localhost:3000/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ links })
        });
        if (fallbackResponse.ok) {
          console.log('Fallback to localhost successful');
          return true;
        }
      }
      
      return false;
  }
  } catch (error) {
      console.error('Error connecting to server:', error);
      throw error; // 重新抛出错误，让调用者处理
    }
}

/**
 * 删除链接的统一接口
 */
async function deleteLinkFromServer(linkId) {
  try {
    const apiUrl = `${API_BASE_URL}/links/${linkId}`;
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Link deleted from server:', result);
      return true;
    } else {
      console.warn('Failed to delete link from server:', await response.text());
      return false;
    }
  } catch (error) {
    console.warn('Error connecting to server for deletion:', error);
    return false;
  }
}

/**
 * 清空所有链接的统一接口
 */
async function clearLinksFromServer() {
  try {
    const apiUrl = `${API_BASE_URL}/links`;
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('All links cleared from server:', result);
      return true;
    } else {
      console.warn('Failed to clear links from server:', await response.text());
      return false;
    }
  } catch (error) {
    console.warn('Error connecting to server for clearing:', error);
    return false;
  }
}

/**
 * 获取当前环境信息
 */
function getEnvironmentInfo() {
  return {
    isCloudflarePages,
    apiBaseUrl: API_BASE_URL,
    environment: (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) || 'development'
  };
}

// 导出函数
window.CloudflareAdapter = {
  loadLinksFromServer,
  saveLinksToServer,
  deleteLinkFromServer,
  clearLinksFromServer,
  getEnvironmentInfo
};