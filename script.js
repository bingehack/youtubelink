// YouTube视频链接管理和随机推荐工具
// 作者: 前端开发工程师
// 功能: 管理YouTube视频链接，提供随机推荐功能

// 全局配置和变量定义
let appConfig = null;
let youtubeLinksItems = [];

// 硬编码的YouTube链接正则表达式
const shortLinkPattern = /^(https?:\/\/)?(youtu\.be\/|(www\.)?youtube\.com\/watch\?v=)([\w-]+)/;

// 配置加载函数
async function loadConfig() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) {
      throw new Error('HTTP error! status: ' + response.status);
    }
    
    appConfig = await response.json();
    console.log('Configuration loaded successfully:', appConfig);
    return appConfig;
  } catch (error) {
    console.error('Failed to load config:', error);
    // 回退到默认配置
    appConfig = {
      storage: {
        keys: {
          youtubeLinks: 'youtube_links',
          theme: 'theme_preference'
        }
      },
      pagination: {
        itemsPerPage: 10
      }
    };
    return appConfig;
  }
}

// 获取配置项的辅助函数
function getConfig(path, defaultValue = null) {
  if (!appConfig) return defaultValue;
  
  const parts = path.split('.');
  let value = appConfig;
  
  for (const part of parts) {
    if (value[part] === undefined) {
      return defaultValue;
    }
    value = value[part];
  }
  
  return value;
}

// 检查KV存储状态
async function checkKVStorageStatus() {
  try {
    // 首先检查localStorage中的KV存储状态
    const cachedStatus = localStorage.getItem('kv_storage_status');
    if (cachedStatus === 'error') {
      console.error('KV存储状态缓存显示配置错误');
      // 显示KV存储错误信息
      if (typeof showNotification === 'function' && !localStorage.getItem('kv_warning_shown')) {
        // 创建一个更详细的KV配置指南通知
        const notificationContent = 'KV存储配置错误 - 跨浏览器同步不可用\n\n' +
          '由于项目使用wrangler.toml管理KV绑定，请按以下步骤配置：\n\n' +
          '1. 确保在wrangler.toml文件中有以下配置：\n' +
          '   kv_namespaces = [\n' +
          '     { binding = "KV_LINKS", id = "90657b7f0780467eaa0e9ee9f55bdf92" }\n' +
          '   ]\n' +
          '2. 注意：binding值必须为"KV_LINKS"（区分大小写）\n' +
          '3. ID必须为您提供的命名空间ID\n' +
          '4. 移除或省略preview_id参数\n' +
          '5. 保存文件并重新部署项目\n\n' +
          '详细指南请参考项目的README.md文档';
        
        showNotification(notificationContent, 'error', 20000);
        localStorage.setItem('kv_warning_shown', 'true'); // 避免重复显示
      }
      return false;
    }
    
    // 发送一个测试请求来检查KV存储状态
    const response = await fetch('/api/links', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      // 获取错误详情
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: '无法解析错误响应' };
      }
      
      // 检查是否是KV存储配置错误
      if (response.status === 503 && errorData.error && errorData.error.includes('KV_LINKS')) {
        console.error('KV存储配置问题:', errorData.error);
        console.error('详细说明:', errorData.note || '');
        if (errorData.guidance) {
          console.error('配置指南:', errorData.guidance);
        }
        
        localStorage.setItem('kv_storage_status', 'error');
        // 显示KV存储错误信息
        if (typeof showNotification === 'function' && !localStorage.getItem('kv_warning_shown')) {
          // 创建一个包含服务器返回的所有相关信息的详细通知
          let notificationContent = 'KV存储配置错误: ' + errorData.error + '\n';
          
          if (errorData.note) {
            notificationContent += '\n' + errorData.note + '\n';
          }
          
          // 添加重要提示
          notificationContent += '\n重要提示：在wrangler.toml中必须使用\"KV_LINKS\"作为binding值！\n';
          
          if (errorData.guidance) {
            notificationContent += '\n配置步骤:\n' + errorData.guidance;
          } else {
            // 默认配置指南
            notificationContent += '\n\n配置步骤:\n1. 确保wrangler.toml中有正确配置:\n   kv_namespaces = [\n     { binding = "KV_LINKS", id = "90657b7f0780467eaa0e9ee9f55bdf92" }\n   ]\n2. 确保binding值为\"KV_LINKS\"\n3. 移除preview_id参数\n4. 重新部署项目';
          }
          
          showNotification(notificationContent, 'error', 20000);
          localStorage.setItem('kv_warning_shown', 'true'); // 避免重复显示
        }
        return false;
      }
    } else {
      // 清除之前的错误状态
      localStorage.removeItem('kv_storage_status');
      localStorage.removeItem('kv_warning_shown');
    }
    
    // 即使是200状态，也检查是否有警告信息
    const data = await response.json();
    if (data && data.warning) {
      console.warn('KV存储状态检查发现警告:', data.warning);
      // 现在在生产环境也显示警告，因为这是重要的配置问题
      if (typeof showNotification === 'function') {
        showNotification(data.warning, 'warning', 8000);
      }
    }
    
    return true;
  } catch (error) {
    console.error('KV storage status check failed:', error);
    // 检查是否是KV存储配置错误
    if (error.message && error.message.includes('KV存储配置错误')) {
      localStorage.setItem('kv_storage_status', 'error');
      if (typeof showNotification === 'function' && !localStorage.getItem('kv_warning_shown')) {
        // 直接使用错误消息中的完整内容
        showNotification(error.message, 'error', 20000);
        localStorage.setItem('kv_warning_shown', 'true');
      }
    }
    return false;
  }
}
