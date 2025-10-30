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
      throw new Error(`HTTP error! status: ${response.status}`);
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
let selectedLinks = new Set();
let selectedRandomLinks = new Set(); // 用于随机推荐区域的已选链接
let currentPage = 1; // 当前页码
const itemsPerPage = 10; // 每页显示的链接数量

// 打字字效果
function typingEffect(element, words, typingSpeed = 100, pauseTime = 1000) {
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentWord = words[wordIndex];

        if (isDeleting) {
            // 删除字符
            element.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            // 添加字符
            element.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }

        // 处理删除/添加状态转换
        if (!isDeleting && charIndex === currentWord.length) {
            isDeleting = true;
            setTimeout(type, pauseTime); // 完成单词后暂停
            
            // 显示副标题
            if (wordIndex === 0) {
                setTimeout(() => {
                    document.getElementById('subtitle').style.opacity = '1';
                }, pauseTime / 2);
            }
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length; // 循环切换单词
            setTimeout(type, 200); // 短暂暂停后开始新单词
        } else {
            // 继续当前操作
            setTimeout(type, isDeleting ? typingSpeed/2 : typingSpeed);
        }
    }

    type(); // 启动动画
}

// 鼠标跟随效果
function initMouseFollowEffect() {
    const container = document.getElementById('mouse-follow-container');
    let lastX = 0, lastY = 0;
    const minDistance = 100; // 最小触发距离

    document.addEventListener('mousemove', (e) => {
        const currentX = e.clientX;
        const currentY = e.clientY;

        // 计算与上次位置的距离
        const distance = Math.sqrt(
            Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2)
        );

        // 如果移动距离足够大，创建新元素
        if (distance > minDistance) {
            createFollowElement(currentX, currentY);
            lastX = currentX;
            lastY = currentY;
        }
    });

    function createFollowElement(x, y) {
        const element = document.createElement('div');
        element.className = 'mouse-follow-element';
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.opacity = '0';

        container.appendChild(element);

        // 动画
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translate(-50%, -50%) scale(1.2)';

            // 淡出
            setTimeout(() => {
                element.style.opacity = '0';
                element.style.transform = 'translate(-50%, -50%) scale(0.8)';

                // 移除元素
                setTimeout(() => {
                    container.removeChild(element);
                }, 300);
            }, 500);
        }, 10);
    }
}

// 滚动渐入效果
function initScrollReveal() {
    const revealElements = document.querySelectorAll('[data-scroll-reveal]');

    const revealOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = element.getAttribute('data-delay') || 0;

                setTimeout(() => {
                    element.classList.add('animate-fade-in');
                    element.style.opacity = '1';
                }, delay);

                // 只触发一次
                revealOnScroll.unobserve(element);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    revealElements.forEach(element => {
        revealOnScroll.observe(element);
        element.style.opacity = '0';
    });
}

// DOM元素
const elements = {
    addLinkBtn: document.getElementById('add-link'),
    formatLinksBtn: document.getElementById('format-links'),
    youtubeLinkInput: document.getElementById('youtube-link'),
    refreshRandomBtn: document.getElementById('refresh-random'),
    clearAllBtn: document.getElementById('clear-all'),
    randomLinksContainer: document.getElementById('random-links'),
    storedLinksContainer: document.getElementById('stored-links-container'),
    storedLinksList: document.getElementById('stored-links'),
    toggleListBtn: document.getElementById('toggle-list'),
    copySelectedBtn: document.getElementById('copy-selected'),
    toggleThemeBtn: document.getElementById('toggle-theme'),
    selectAllBtn: document.getElementById('select-all'),
    copyLinksBtn: document.getElementById('copy-links'),
    deleteLinksBtn: document.getElementById('delete-links')
};

// 初始化应用
async function initApp() {
    try {
        // 首先加载配置文件
        await loadConfig();
        
        // 初始化打字效果
        const typingText = document.getElementById('typing-text');
        if (typingText) {
            typingEffect(typingText, ['视频链接管理', '视频推荐', '高效工具'], 80, 1500);
        }
        
        // 初始化鼠标跟随效果
        initMouseFollowEffect();
        
        // 初始化滚动渐入效果
        initScrollReveal();
        
        // 清空已选链接集合
        selectedLinks.clear();
        
        // 在加载数据前，先检查KV存储状态
        await checkKVStorageStatus();
        
        // 优先从服务器加载数据，如果失败则从localStorage加载
        await loadLinks();
        
        // 渲染已存储链接列表
        renderStoredLinks();
        
        // 生成随机推荐链接
        generateRandomRecommendations();
        
        // 更新统计信息
        updateStats();
        
        // 更新复制已选按钮状态
        updateCopySelectedButton();
        
        // 初始化主题
        initTheme();
        
        // 绑定事件监听器
        bindEventListeners();
    } catch (error) {
        console.error('Error initializing app:', error);
        // 即使出错也要尝试渲染页面，提供基本功能
        try {
            if (typeof loadLinksFromLocalStorage === 'function') {
                loadLinksFromLocalStorage();
            }
            if (typeof renderStoredLinks === 'function') {
                renderStoredLinks();
            }
        } catch (fallbackError) {
            console.error('Error in fallback initialization:', fallbackError);
        }
    }
}

// 增强版从服务器加载链接（使用CloudflareAdapter）
async function loadLinksFromServer() {
  try {
    // 记录加载尝试
    console.log('Starting server links load operation');
    const startTime = Date.now();
    
    if (window.CloudflareAdapter && window.CloudflareAdapter.loadLinksFromServer) {
      console.log('Using CloudflareAdapter to load links from server');
      const result = await window.CloudflareAdapter.loadLinksFromServer();
      
      // 处理适配器返回的结果格式
      if (result && typeof result === 'object' && result.success && Array.isArray(result.links)) {
        // 检查是否有警告信息
        if (result.warning) {
          console.warn('服务器返回警告:', result.warning, result.troubleshooting);
          if (typeof showNotification === 'function') {
            showNotification(result.warning, 'warning', 8000);
            if (result.troubleshooting) {
              setTimeout(() => {
                showNotification(result.troubleshooting, 'warning', 10000);
              }, 3000);
            }
          }
        }
        console.log(`Successfully loaded ${result.links.length} links from server via adapter`);
        return result.links;
      } else if (Array.isArray(result)) {
        console.log(`Loaded ${result.length} links from server via adapter (array format)`);
        return result;
      }
      
      console.warn('Received unexpected format from CloudflareAdapter:', result);
      return null;
    } else {
      // 向后兼容：如果适配器未加载，使用增强的原有实现
      console.log('Direct server load attempt (adapter not available)');
      const response = await fetch('/api/links', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // 添加缓存控制以确保获取最新数据
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        console.warn(`Failed to load links from server (HTTP ${response.status}), falling back to localStorage`);
        if (typeof showNotification === 'function') {
          showNotification('无法从服务器加载数据，使用本地存储。刷新页面可能导致数据丢失。', 'error', 5000);
        }
        return null;
      }
      
      const data = await response.json();
      
      // 处理增强的API响应格式
      if (data && data.success && Array.isArray(data.links)) {
        // 检查是否有警告信息
        if (data.warning) {
          console.warn('服务器返回警告:', data.warning, data.troubleshooting);
          if (typeof showNotification === 'function') {
            showNotification(data.warning, 'warning', 8000);
            if (data.troubleshooting) {
              setTimeout(() => {
                showNotification(data.troubleshooting, 'warning', 10000);
              }, 3000);
            }
          }
        }
        console.log(`Successfully loaded ${data.links.length} links from server (enhanced API format)`);
        // 存储服务器数据的版本信息用于后续冲突检测
        localStorage.setItem('youtube_links_server_timestamp', data.timestamp || new Date().toISOString());
        return data.links;
      } else if (Array.isArray(data)) {
        // 兼容旧格式
        console.log(`Loaded ${data.length} links from server (legacy format)`);
        return data;
      } else {
        console.warn('Received invalid response format from server:', data);
        return null;
      }
    }
  } catch (error) {
    console.error('Error loading links from server:', error.message);
    if (typeof showNotification === 'function') {
      showNotification('加载服务器数据出错，使用本地存储。刷新页面可能导致数据丢失。', 'error', 5000);
    }
    return null;
  }
}

// 增强版从localStorage加载链接，带数据验证和错误恢复
function loadLinksFromLocalStorage() {
    try {
        const linksKey = getConfig('storage.keys.youtubeLinks', 'youtube_links');
        const storedLinks = localStorage.getItem(linksKey);
        
        if (!storedLinks) {
            console.log('No links found in localStorage');
            youtubeLinksItems = [];
            return youtubeLinksItems;
        }
        
        // 解析存储的链接，带错误捕获
        const parsedLinks = JSON.parse(storedLinks);
        
        // 确保数据格式正确，如果是旧格式（纯URL数组），转换为新格式
        if (!Array.isArray(parsedLinks)) {
            console.error('Invalid links format in localStorage - not an array');
            // 清理损坏的数据
            localStorage.removeItem(linksKey);
            youtubeLinksItems = [];
            return youtubeLinksItems;
        }
        
        if (parsedLinks.length > 0) {
            if (typeof parsedLinks[0] === 'string') {
                // 旧格式，转换为新格式
                console.log('Converting legacy link format from localStorage');
                youtubeLinksItems = parsedLinks
                    .filter(url => url && typeof url === 'string')
                    .map(url => ({
                        url: url,
                        timestamp: new Date().toISOString()
                    }));
            } else {
                // 新格式，先验证每个链接对象
                console.log('Validating links from localStorage');
                youtubeLinksItems = parsedLinks.filter(link => {
                    return link && typeof link === 'object' && link.url && typeof link.url === 'string';
                });
            }
            
            // 去重
            youtubeLinksItems = removeDuplicates(youtubeLinksItems);
            console.log(`Loaded ${youtubeLinksItems.length} valid links from localStorage`);
        } else {
            youtubeLinksItems = [];
        }
        
        return youtubeLinksItems;
    } catch (error) {
        console.error('Error loading links from localStorage:', error.message);
        // 清理损坏的数据
        try {
            const linksKey = getConfig('storage.keys.youtubeLinks', 'youtube_links');
            localStorage.removeItem(linksKey);
            console.log('Cleared corrupted localStorage data');
        } catch (cleanupError) {
            console.error('Failed to clear corrupted localStorage:', cleanupError.message);
        }
        youtubeLinksItems = [];
        return youtubeLinksItems;
    }
}

// 增强版加载函数，添加数据版本检查和冲突解决
async function loadLinks() {
  console.log('Starting links load process with conflict resolution');
  
  try {
    // 首先加载本地数据作为基准
    const localLinks = loadLinksFromLocalStorage();
    const localTimestamp = localStorage.getItem('youtube_links_local_timestamp') || '0';
    console.log(`Local storage has ${localLinks.length} links (timestamp: ${localTimestamp})`);
    
    // 然后尝试从服务器加载数据
    const serverLinksResult = await loadLinksFromServer();
    
    // 如果服务器加载成功
    if (serverLinksResult && Array.isArray(serverLinksResult)) {
      const serverLinks = serverLinksResult;
      const serverTimestamp = localStorage.getItem('youtube_links_server_timestamp') || '0';
      console.log(`Server loaded ${serverLinks.length} links (timestamp: ${serverTimestamp})`);
      
      // 比较本地和服务器数据，进行智能合并
      if (serverLinks.length === 0) {
        // 服务器为空，使用本地数据
        console.log('Server has no links, using local data and syncing to server');
        youtubeLinksItems = localLinks;
        // 尝试将本地数据同步到服务器
        await saveLinksToServer(localLinks);
      } else if (localLinks.length === 0) {
        // 本地为空，使用服务器数据
        console.log('Local storage is empty, using server data');
        youtubeLinksItems = serverLinks;
        saveLinksToLocalStorage(serverLinks);
      } else {
        // 两者都有数据，进行智能合并
        console.log('Both server and local have data, performing smart merge');
        
        // 创建URL映射以避免重复
        const urlMap = new Map();
        
        // 优先添加服务器数据
        serverLinks.forEach(link => {
          if (link && link.url) {
            // 规范化URL以去除不同查询参数的影响
            const normalizedUrl = link.url.split('?')[0].split('#')[0];
            urlMap.set(normalizedUrl, {
              ...link,
              source: 'server',
              timestamp: link.timestamp || serverTimestamp
            });
          }
        });
        
        // 添加本地数据中不存在于服务器的链接
        localLinks.forEach(link => {
          if (link && link.url) {
            const normalizedUrl = link.url.split('?')[0].split('#')[0];
            if (!urlMap.has(normalizedUrl)) {
              urlMap.set(normalizedUrl, {
                ...link,
                source: 'local',
                timestamp: link.timestamp || localTimestamp
              });
            }
          }
        });
        
        // 转换回数组并按时间戳排序
        youtubeLinksItems = Array.from(urlMap.values()).sort((a, b) => {
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
        
        console.log(`Smart merge completed: ${youtubeLinksItems.length} unique links`);
        
        // 更新双端存储
        saveLinksToLocalStorage(youtubeLinksItems);
        await saveLinksToServer(youtubeLinksItems);
      }
    } else {
      // 服务器加载失败，使用本地数据
      console.log('Falling back to local storage data');
      youtubeLinksItems = localLinks;
    }
    
    return youtubeLinksItems;
  } catch (error) {
    console.error('Error in loadLinks with conflict resolution:', error.message);
    // 发生错误时，确保至少返回本地数据
    const fallbackLinks = loadLinksFromLocalStorage();
    youtubeLinksItems = fallbackLinks;
    return fallbackLinks;
  }
}

// 增强版保存链接到服务器（使用CloudflareAdapter）
async function saveLinksToServer(links) {
  try {
    if (window.CloudflareAdapter && window.CloudflareAdapter.saveLinksToServer) {
      console.log(`Using CloudflareAdapter to save ${links.length} links to server`);
      return await window.CloudflareAdapter.saveLinksToServer(links);
    } else {
      // 向后兼容：如果适配器未加载，使用增强的原有实现
      console.log(`Direct server save attempt (adapter not available) for ${links.length} links`);
      
      // 验证链接数组格式
      if (!Array.isArray(links)) {
        console.error('Invalid links format for server save');
        return false;
      }
      
      // 过滤出有效的链接对象
      const validLinks = links.filter(link => {
        return link && typeof link === 'object' && link.url && typeof link.url === 'string';
      });
      
      if (validLinks.length === 0) {
        console.warn('No valid links to save to server');
        return false;
      }
      
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ links: validLinks })
      });
      
      // 即使响应状态不是200，也尝试解析响应以获取更多信息
      try {
        const result = await response.json();
        
        if (result.success) {
          console.log(`Successfully saved ${validLinks.length} links to server`);
          return true;
        } else {
          console.warn(`Server rejected save request: ${result.message || 'Unknown error'}`, 
            result.error ? `(${result.error})` : '');
          
          // 检查是否有关于持久性问题的备注
          if (result.note) {
            console.info(`Server note: ${result.note}`);
            // 仅在开发环境显示KV存储相关的技术警告
            if (process.env.NODE_ENV === 'development' && typeof showNotification === 'function') {
              // 简化错误通知，避免用户困惑
              showNotification('服务器同步暂时不可用，但数据已保存在本地', 'info');
            }
          }
          return false;
        }
      } catch (parseError) {
        console.warn(`Failed to parse server response: ${parseError.message}`);
        return false;
      }
    }
  } catch (error) {
    console.error('Network error saving to server:', error.message);
    return false;
  }
}

// 增强版保存链接到localStorage，带时间戳和错误恢复
function saveLinksToLocalStorage(links = youtubeLinksItems) {
    try {
        const linksKey = getConfig('storage.keys.youtubeLinks', 'youtube_links');
        const timestampKey = 'youtube_links_local_timestamp';
        
        // 确保links是数组
        if (!Array.isArray(links)) {
            console.error('Invalid links format for localStorage');
            return false;
        }
        
        // 生成当前时间戳
        const currentTimestamp = new Date().toISOString();
        
        // 过滤并增强链接对象，确保每个链接都有时间戳和唯一ID
        const validLinks = links
            .filter(link => {
                return link && typeof link === 'object' && link.url && typeof link.url === 'string';
            })
            .map(link => ({
                ...link,
                id: link.id || generateUniqueId(), // 确保每个链接都有唯一ID
                timestamp: link.timestamp || currentTimestamp, // 保留现有时间戳或使用当前时间
                lastUpdated: currentTimestamp // 添加最后更新时间
            }));
        
        // 保存数据和时间戳
        localStorage.setItem(linksKey, JSON.stringify(validLinks));
        localStorage.setItem(timestampKey, currentTimestamp);
        
        console.log(`Successfully saved ${validLinks.length} links to localStorage at ${currentTimestamp}`);
        return true;
    } catch (error) {
        console.error('Error saving links to localStorage:', error.message);
        
        // 尝试通过清空localStorage并重新尝试来恢复
        try {
            const linksKey = getConfig('storage.keys.youtubeLinks', 'youtube_links');
            const timestampKey = 'youtube_links_local_timestamp';
            
            // 清除存储的数据
            localStorage.removeItem(linksKey);
            localStorage.removeItem(timestampKey);
            console.log('Cleared localStorage for recovery');
            
            // 重试，至少保存一个空数组以确保localStorage状态良好
            const recoveryTimestamp = new Date().toISOString();
            localStorage.setItem(linksKey, JSON.stringify([]));
            localStorage.setItem(timestampKey, recoveryTimestamp);
            console.log('Recovery successful, localStorage reset to empty state');
            return true;
        } catch (recoverError) {
            console.error('Failed to recover localStorage:', recoverError.message);
            return false;
        }
    }
}

// 生成唯一ID的辅助函数
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 增强版保存函数，确保数据持久化，添加自动重试和同步机制
async function saveLinks(links = youtubeLinksItems, silent = false) {
  console.log(`Starting enhanced save operation for ${links.length} links`);
  
  // 记录保存开始时间，用于性能监控
  const startTime = Date.now();
  
  // 首先保存到localStorage（保证本地功能正常）
  let localSuccess = false;
  let retryCount = 0;
  const maxLocalRetries = 2;
  
  // 本地存储保存带重试逻辑
  while (!localSuccess && retryCount < maxLocalRetries) {
    if (retryCount > 0) {
      console.log(`Retrying local save (attempt ${retryCount + 1})...`);
    }
    localSuccess = saveLinksToLocalStorage(links);
    retryCount++;
    
    // 如果失败且还有重试机会，等待一小段时间
    if (!localSuccess && retryCount < maxLocalRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // 如果localStorage保存失败，显示警告并尝试备选方案
  if (!localSuccess) {
    console.error('Failed to save to localStorage after multiple attempts');
    
    // 尝试使用sessionStorage作为备选
    try {
      const fallbackLinks = JSON.stringify(links.filter(link => 
        link && typeof link === 'object' && link.url && typeof link.url === 'string'
      ));
      sessionStorage.setItem('youtube_links_fallback', fallbackLinks);
      console.log('Fallback to sessionStorage successful');
      
      if (typeof showNotification === 'function') {
        showNotification('本地存储保存失败，已临时保存数据到会话存储。请尽快保存数据！', 'error');
      }
    } catch (fallbackError) {
      console.error('Fallback to sessionStorage failed:', fallbackError);
      if (typeof showNotification === 'function') {
        showNotification('所有本地存储方式均失败，请立即备份您的数据！', 'error');
      }
      return false;
    }
  }
  
  // 服务器保存带重试逻辑
  let serverSuccess = false;
  retryCount = 0;
  const maxServerRetries = 3;
  const retryDelays = [500, 1000, 2000]; // 递增的重试延迟
  
  while (!serverSuccess && retryCount < maxServerRetries) {
    if (retryCount > 0) {
      console.log(`Retrying server save (attempt ${retryCount + 1})...`);
      // 等待指定的延迟时间
      await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount - 1]));
    }
    
    serverSuccess = await saveLinksToServer(links);
    retryCount++;
  }
  
  // 记录操作结果和性能数据
  const endTime = Date.now();
  console.log(`Save operation complete (took ${endTime - startTime}ms) - Local: ${localSuccess}, Server: ${serverSuccess}`);
  
  // 根据不同的保存结果显示适当的通知（如果不是静默模式）
  if (!silent) {
    if (localSuccess && serverSuccess) {
      // 完全成功
      if (typeof showNotification === 'function') {
        showNotification('数据已成功保存并同步到服务器', 'info');
      }
    } else if (localSuccess && !serverSuccess) {
      // 本地成功但服务器失败
      console.warn('Data saved locally but could not be synced to server after multiple retries');
      
      // 注册一个同步事件处理器，尝试在网络恢复时同步
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-youtube-links');
          console.log('Background sync registered for when network is available');
          
          if (typeof showNotification === 'function') {
            showNotification('数据已保存在本地，将在网络恢复时自动同步', 'info');
          }
        } catch (syncError) {
          console.warn('Background sync registration failed:', syncError);
          if (typeof showNotification === 'function') {
            showNotification('数据已保存在本地，但无法设置自动同步。请稍后手动同步或刷新页面。', 'warning');
          }
        }
      } else {
        if (typeof showNotification === 'function') {
          showNotification('数据已保存在本地，但无法同步到服务器。在不同浏览器或设备上可能无法访问。', 'warning');
        }
      }
    }
  }
  
  // 无论是否静默模式，都标记数据需要同步
  if (localSuccess && !serverSuccess) {
    localStorage.setItem('youtube_links_needs_sync', 'true');
  }
  
  return localSuccess; // 即使服务器同步失败，只要本地保存成功，就返回true
}

// 检查是否有待同步的数据并尝试同步
async function checkAndSyncPendingData() {
  try {
    const needsSync = localStorage.getItem('youtube_links_needs_sync') === 'true';
    if (needsSync && navigator.onLine) {
      console.log('Detected pending data that needs syncing...');
      const localLinks = loadLinksFromLocalStorage();
      const syncSuccess = await saveLinksToServer(localLinks);
      
      if (syncSuccess) {
        localStorage.removeItem('youtube_links_needs_sync');
        console.log('Pending data successfully synced to server');
        if (typeof showNotification === 'function') {
          showNotification('之前保存的数据已成功同步到服务器', 'info');
        }
      }
    }
  } catch (error) {
    console.error('Error checking/syncing pending data:', error);
  }
}



// 显示通知函数 - 作为showStatusMessage的别名，确保兼容性
function showNotification(message, type = 'info', duration = 3000) {
  if (typeof showStatusMessage === 'function') {
    showStatusMessage(message, type, duration);
  } else {
    console.warn('showStatusMessage not available, using console instead');
    console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info'](message);
  }
}

// 注册网络状态变化监听器
function registerNetworkListeners() {
  // 监听在线状态变化
  window.addEventListener('online', async () => {
    console.log('Network connection restored, checking for pending syncs...');
    await checkAndSyncPendingData();
  });
  
  // 监听页面加载
  window.addEventListener('load', async () => {
    console.log('Page loaded, checking for pending syncs...');
    await checkAndSyncPendingData();
  });
}

// 检查KV存储状态
async function checkKVStorageStatus() {
  try {
    // 发送一个测试请求来检查KV存储状态
    const response = await fetch('/api/links', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-cache'
    });
    
    // 即使是200状态，也检查是否有警告信息
    const data = await response.json();
    if (data && data.warning) {
      console.warn('KV存储状态检查发现警告:', data.warning);
      // 仅在开发环境显示KV存储相关警告，避免用户困惑
      if (process.env.NODE_ENV === 'development' && typeof showNotification === 'function') {
        showNotification(data.warning, 'info', 5000);
      }
    }
  } catch (error) {
    console.log('KV storage status check failed, assuming offline/standalone mode');
    // 静默失败，不向用户显示错误，确保应用继续正常工作
  }
}

// 在应用初始化时注册监听器
registerNetworkListeners();

// 移除重复链接
function removeDuplicates(links) {
    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of links) {
        if (!seenUrls.has(link.url)) {
            seenUrls.add(link.url);
            uniqueLinks.push(link);
        }
    }
    
    return uniqueLinks;
}

// 验证YouTube链接
function isValidYouTubeLink(url) {
    if (!url) return false;
    
    // 简化的YouTube链接验证正则表达式
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
}

// 增强版删除链接从服务器
async function deleteLinkFromServer(linkId) {
  try {
    console.log(`Attempting to delete link with ID: ${linkId}`);
    
    if (window.CloudflareAdapter && window.CloudflareAdapter.deleteLinkFromServer) {
      console.log('Using CloudflareAdapter to delete link');
      return await window.CloudflareAdapter.deleteLinkFromServer(linkId);
    } else {
      // 直接删除实现
      const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
        method: 'DELETE'
      });
      
      // 即使响应状态不是200，也尝试解析响应
      try {
        const result = await response.json();
        
        if (result.success) {
          console.log(`Successfully deleted link ${linkId} from server`);
          return true;
        } else {
          console.warn(`Failed to delete link from server: ${result.message || 'Unknown error'}`, 
            result.error ? `(${result.error})` : '');
          return false;
        }
      } catch (parseError) {
        console.warn(`Failed to parse server response during deletion: ${parseError.message}`);
        return false;
      }
    }
  } catch (error) {
    console.error('Network error deleting link from server:', error.message);
    return false;
  }
}

// 提取YouTube视频ID（可选功能）
function extractYouTubeVideoId(url) {
    if (!url) return null;
    
    // 从各种YouTube链接格式中提取视频ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 从一行文本中提取所有YouTube链接
function extractLinksFromLine(line) {
    // 直接处理所有可能的YouTube链接格式，特别关注连续的短链接
    const extractedLinks = [];
    
    // 首先专门处理连续的youtu.be短链接
    // 找到所有"https://youtu.be/"的位置
    const shortLinkPattern = /https:\/\/youtu\.be\//g;
    let match;
    const shortLinkPositions = [];
    
    // 重置正则表达式的lastIndex以确保从头开始匹配
    shortLinkPattern.lastIndex = 0;
    
    // 记录所有短链接的起始位置
    while ((match = shortLinkPattern.exec(line)) !== null) {
        shortLinkPositions.push(match.index);
    }
    
    // 提取每个完整的短链接
    for (const startPos of shortLinkPositions) {
        // 提取完整的短链接：https://youtu.be/ + 11位视频ID
        const linkLength = 17 + 11; // "https://youtu.be/".length + 11 = 28
        const link = line.substring(startPos, startPos + linkLength);
        
        // 确保提取的链接是有效的YouTube链接
        if (isValidYouTubeLink(link)) {
            extractedLinks.push(link);
        }
    }
    
    // 如果没有找到短链接，尝试提取标准的YouTube链接
    if (extractedLinks.length === 0) {
        // 尝试匹配所有可能的YouTube链接格式
        const youtubeLinkPattern = /(https:\/\/www\.youtube\.com\/(?:watch\?v=|embed\/)[a-zA-Z0-9_-]{11}|https:\/\/youtu\.be\/[a-zA-Z0-9_-]{11})/g;
        
        // 重置正则表达式的lastIndex
        youtubeLinkPattern.lastIndex = 0;
        
        // 提取所有匹配的链接
        let linkMatch;
        while ((linkMatch = youtubeLinkPattern.exec(line)) !== null) {
            extractedLinks.push(linkMatch[0]);
        }
    }
    
    // 去重 - 确保每个链接只出现一次
    const uniqueLinks = [...new Set(extractedLinks)];
    
    return uniqueLinks;
}

// 格式化链接
function formatLinks() {
    const inputText = elements.youtubeLinkInput.value.trim();
    if (!inputText) {
        showStatusMessage('请输入链接后再进行格式化', 'error');
        return;
    }
    
    // 直接使用extractLinksFromLine函数处理整个输入文本
    // 这个函数已经能够正确识别连续的YouTube短链接
    let extractedLinks = extractLinksFromLine(inputText);
    
    // 如果直接提取没有找到足够的链接，再尝试按行处理
    if (extractedLinks.length === 0) {
        // 按行分割文本
        const lines = inputText.split(/\r?\n/);
        extractedLinks = [];
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                // 从每行中提取链接
                const linksInLine = extractLinksFromLine(trimmedLine);
                if (linksInLine.length > 0) {
                    extractedLinks.push(...linksInLine);
                } else if (isValidYouTubeLink(trimmedLine)) {
                    // 如果整行都是一个有效的YouTube链接
                    extractedLinks.push(trimmedLine);
                }
            }
        });
    }
    
    // 去重，确保每个链接只出现一次
    const uniqueLinks = [...new Set(extractedLinks)];
    
    if (uniqueLinks.length === 0) {
        showStatusMessage('未找到有效的YouTube链接', 'error');
        return;
    }
    
    // 确保链接是标准格式 - 对于短链接，正确提取视频ID并重建完整链接
    const formattedLinks = uniqueLinks.map(link => {
        if (link.startsWith('https://youtu.be/')) {
            // 提取视频ID
            const videoIdMatch = link.match(/https:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/);
            if (videoIdMatch && videoIdMatch[1]) {
                // 重建完整的短链接
                return `https://youtu.be/${videoIdMatch[1]}`;
            }
        }
        return link;
    });
    
    // 将提取的链接分行显示在输入框中 - 确保每个链接占一行
    elements.youtubeLinkInput.value = formattedLinks.join('\n');
    
    // 自动调整输入框高度以显示所有内容
    elements.youtubeLinkInput.style.height = 'auto';
    elements.youtubeLinkInput.style.height = (elements.youtubeLinkInput.scrollHeight) + 'px';
    
    showStatusMessage(`已提取并格式化 ${formattedLinks.length} 个YouTube链接`, 'success');
}

// 添加新链接
async function addNewLink() {
    const inputText = elements.youtubeLinkInput.value.trim();
    if (!inputText) {
        showStatusMessage('请输入或粘贴YouTube视频链接', 'error');
        return;
    }
    

    
    // 改进的链接提取方式：首先按行分割，然后在每行中寻找所有以https开头的链接
    const validLinks = [];
    const invalidLinks = [];
    const duplicateLinks = [];
    
    // 按行分割文本
    const lines = inputText.split(/\r?\n/);
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            // 如果行中有多个链接（每个以https开头），分别提取
            const linksInLine = extractLinksFromLine(trimmedLine);
            
            if (linksInLine.length > 0) {
                linksInLine.forEach(link => {
                    if (!isValidYouTubeLink(link)) {
                        invalidLinks.push(link);
                    } else if (youtubeLinksItems.some(item => item.url === link)) {
                        duplicateLinks.push(link);
                    } else {
                        validLinks.push(link);
                    }
                });
            } else {
                // 如果没有找到以https开头的链接，则尝试将整行作为一个链接处理
                if (!isValidYouTubeLink(trimmedLine)) {
                    invalidLinks.push(trimmedLine);
                } else if (youtubeLinksItems.some(item => item.url === trimmedLine)) {
                    duplicateLinks.push(trimmedLine);
                } else {
                    validLinks.push(trimmedLine);
                }
            }
        }
    });
    
    // 去重，避免同一链接被多次添加
    const uniqueValidLinks = [...new Set(validLinks)];
    const uniqueInvalidLinks = [...new Set(invalidLinks)];
    const uniqueDuplicateLinks = [...new Set(duplicateLinks)];
    
    // 显示状态消息
    let statusMessage = '';
    if (uniqueValidLinks.length > 0) {
        // 创建包含URL和时间戳的链接对象
        const newLinks = uniqueValidLinks.map(url => ({
            url: url,
            timestamp: new Date().toISOString() // 记录添加时间
        }));
        
        // 添加到列表
        youtubeLinksItems.push(...newLinks);
        
        // 保存到服务器和本地存储
        const saveResult = await saveLinks();
        
        if (!saveResult) {
          // 如果保存失败，添加警告
          errorMessages.push('数据保存失败，请尝试刷新页面后重试');
        }
        
        // 更新UI
        renderStoredLinks();
        updateStats();
        
        // 显示成功消息
        statusMessage += `成功添加 ${uniqueValidLinks.length} 个新链接`;
        
        // 确保复制链接按钮状态正确更新
        updateCopySelectedButton();
        
        // 如果是第一个链接，自动生成随机推荐
        if (youtubeLinksItems.length === uniqueValidLinks.length) {
            generateRandomRecommendations();
        }
}
    
    // 显示错误消息 - 使用数组收集消息，避免多余的逗号
    const errorMessages = [];
    if (uniqueInvalidLinks.length > 0) {
        errorMessages.push(`${uniqueInvalidLinks.length} 个无效链接未添加`);
    }
    
    if (uniqueDuplicateLinks.length > 0) {
        errorMessages.push(`${uniqueDuplicateLinks.length} 个重复链接未添加`);
    }
    
    // 如果有错误消息，添加到状态消息中
    if (errorMessages.length > 0) {
        if (statusMessage) {
            statusMessage += '，' + errorMessages.join('，');
        } else {
            statusMessage = errorMessages.join('，');
        }
    }
    
    showStatusMessage(statusMessage, uniqueValidLinks.length > 0 ? 'info' : 'error');
    
    // 如果所有链接都有效且已添加，清空输入框
    if (uniqueValidLinks.length > 0 && uniqueInvalidLinks.length === 0 && uniqueDuplicateLinks.length === 0) {
        elements.youtubeLinkInput.value = '';
        // 重置输入框高度为默认尺寸
        elements.youtubeLinkInput.style.height = 'auto';
    }
    
    // 如果有有效的新链接添加，重新生成随机推荐
    if (uniqueValidLinks.length > 0) {
        generateRandomRecommendations();
        // 确保复制链接按钮状态正确更新
        updateCopySelectedButton();
    }
}

// 显示状态消息 - 使用浮动弹出层而不是修改页面元素
function showStatusMessage(message, type, duration = 3000) {
    // 创建浮动弹出层元素
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    
    // 设置样式
    Object.assign(toast.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '12px 24px',
        borderRadius: '8px',
        color: 'white',
        backgroundColor: type === 'error' ? '#ff4444' : '#4CAF50',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: '9999',
        fontWeight: 'bold',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        whiteSpace: 'pre-line', // 支持换行符
        maxWidth: '80%',
        textAlign: 'center'
    });
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 显示弹出层
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // 指定时间后淡出并移除
    setTimeout(() => {
        toast.style.opacity = '0';
        // 等待动画完成后移除元素
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, duration);
}

// 生成随机推荐链接
function generateRandomRecommendations() {
    // 清空容器
    elements.randomLinksContainer.innerHTML = '';
    
    // 如果没有链接，显示空状态
    if (youtubeLinksItems.length === 0) {
        elements.randomLinksContainer.innerHTML = '<div class="empty-state text-center text-gray-400 py-8">暂无推荐链接，请先添加YouTube视频链接</div>';
        return;
    }
    
    // 复制链接数组以避免修改原始数据
    const linksCopy = [...youtubeLinksItems];
    
    // 随机排序
    shuffleArray(linksCopy);
    
    // 取前20个链接
    const randomLinks = linksCopy.slice(0, 20);
    
    // 创建一个文本区域用于显示链接
    const linksTextarea = document.createElement('div');
    linksTextarea.className = 'random-links-textarea';
    linksTextarea.style.whiteSpace = 'pre-wrap';
    linksTextarea.style.fontFamily = 'monospace';
    linksTextarea.style.fontSize = '14px';
    linksTextarea.style.lineHeight = '1.7';
    linksTextarea.style.padding = '10px';
    linksTextarea.style.borderRadius = '4px';
    
    // 根据当前主题设置颜色和背景色
    const isDarkTheme = document.body.classList.contains('dark-theme');
    linksTextarea.style.color = isDarkTheme ? '#ffffff' : '#000000'; // 深色主题用白色，浅色主题用黑色
    linksTextarea.style.backgroundColor = isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'; // 为白色主题添加浅色背景
    linksTextarea.style.border = '1px solid ' + (isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'); // 添加边框增强可读性
    
    // 将链接按行显示
    const linksText = randomLinks.map(linkItem => linkItem.url).join('\n');
    linksTextarea.textContent = linksText;
    
    // 添加到容器
    elements.randomLinksContainer.appendChild(linksTextarea);
}

// 一键复制所有随机推荐链接
function copyAllRandomLinks() {
    console.log('复制链接按钮被点击');
    // 获取当前显示的随机链接
    const randomLinksElement = document.querySelector('.random-links-textarea');
    
    // 如果没有链接元素或为空，显示提示
    if (!randomLinksElement || !randomLinksElement.textContent.trim()) {
        showStatusMessage('暂无链接可复制', 'error');
        return;
    }
    
    const linksText = randomLinksElement.textContent;
    console.log('准备复制的链接:', linksText);
    
    // 使用我们的copyToClipboard函数确保兼容性
    copyToClipboard(linksText);
}

// 创建链接元素
function createLinkElement(linkItem, isRandom = false) {
    const link = linkItem.url;
    const linkElement = document.createElement('div');
    linkElement.className = 'link-item';
    linkElement.dataset.link = link;
    
    // 添加复选框
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'link-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'link-select';
    checkbox.value = link;
    
    // 根据是否为随机推荐链接使用不同的选中状态存储
    if (isRandom) {
        checkbox.checked = selectedRandomLinks.has(link);
    } else {
        checkbox.checked = selectedLinks.has(link);
    }
    
    // 复选框事件
    checkbox.addEventListener('change', (e) => {
        if (isRandom) {
            // 随机推荐链接使用selectedRandomLinks
            if (e.target.checked) {
                selectedRandomLinks.add(link);
            } else {
                selectedRandomLinks.delete(link);
            }
        } else {
            // 已存储链接使用selectedLinks
            if (e.target.checked) {
                selectedLinks.add(link);
            } else {
                selectedLinks.delete(link);
            }
            updateCopySelectedButton();
        }
    });
    
    checkboxContainer.appendChild(checkbox);
    
    // 链接内容
    const linkContent = document.createElement('div');
    linkContent.className = 'link-content';
    
    // 添加时间戳
    const timestamp = document.createElement('div');
    timestamp.className = 'link-timestamp';
    timestamp.textContent = formatTimestamp(linkItem.timestamp);
    linkContent.appendChild(timestamp);
    
    // 添加链接文本
    const linkText = document.createElement('a');
    linkText.className = 'link-text';
    linkText.href = link;
    linkText.target = '_blank';
    linkText.rel = 'noopener noreferrer';
    linkText.textContent = link;
    linkContent.appendChild(linkText);
    
    // 链接操作按钮
    const linkActions = document.createElement('div');
    linkActions.className = 'link-actions';
    
    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn copy-btn';
    copyBtn.innerHTML = '<i class="fa fa-copy" aria-hidden="true"></i> 复制';
    copyBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止事件冒泡
        console.log('复制按钮被点击，链接:', link);
        copyToClipboard(link);
    });
    
    linkActions.appendChild(copyBtn);
    
    // 如果不是随机推荐的链接，添加删除按钮
    if (!isRandom) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn delete-btn';
        deleteBtn.innerHTML = '<i class="fa fa-trash" aria-hidden="true"></i> 删除';
        deleteBtn.dataset.link = link; // 添加数据属性存储链接
        
        // 确保按钮可点击并添加防御性检查
        deleteBtn.style.pointerEvents = 'auto';
        deleteBtn.style.cursor = 'pointer';
        
        // 直接绑定点击事件并添加日志以便调试
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // 防止事件冒泡
            console.log('删除按钮被点击，链接:', link);
            deleteLink(link);
        });
        
        linkActions.appendChild(deleteBtn);
    }
    
    linkElement.appendChild(checkboxContainer);
    linkElement.appendChild(linkContent);
    linkElement.appendChild(linkActions);
    
    return linkElement;
}

// 复制到剪贴板
function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
        // 如果是数组，则分行显示
        if (Array.isArray(text)) {
            text = text.join('\n');
        }
        
        if (navigator.clipboard && window.isSecureContext) {
            // 现代浏览器安全上下文
            navigator.clipboard.writeText(text)
                .then(() => {
                    if (text.includes('\n')) {
                        const count = text.split('\n').length;
                        showStatusMessage(`已复制 ${count} 个链接到剪贴板！`, 'info');
                    } else {
                        showStatusMessage('链接已复制到剪贴板！', 'info');
                    }
                    resolve();
                })
                .catch(err => {
                    console.error('无法复制文本: ', err);
                    showStatusMessage('复制失败，请手动复制', 'error');
                    reject(err);
                });
        } else {
            // 传统方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const success = document.execCommand('copy');
                if (success) {
                    if (text.includes('\n')) {
                        const count = text.split('\n').length;
                        showStatusMessage(`已复制 ${count} 个链接到剪贴板！`, 'success');
                    } else {
                        showStatusMessage('链接已复制到剪贴板！', 'success');
                    }
                    resolve();
                } else {
                    throw new Error('命令执行失败');
                }
            } catch (err) {
                console.error('无法复制文本: ', err);
                showStatusMessage('复制失败，请手动复制', 'error');
                reject(err);
            } finally {
                document.body.removeChild(textArea);
            }
        }
    });
}

// 全选/取消全选已存储链接
function toggleSelectAllStored() {
    const checkboxes = document.querySelectorAll('#stored-links .link-select');
    const visibleLinks = getCurrentPageLinks(); // 获取当前页显示的链接
    
    // 检查是否所有可见链接都已选中
    const allVisibleSelected = visibleLinks.every(linkItem => 
        selectedLinks.has(linkItem.url)
    );
    
    if (allVisibleSelected) {
        // 取消全选当前页
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            selectedLinks.delete(checkbox.value);
        });
    } else {
        // 全选当前页
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedLinks.add(checkbox.value);
        });
    }
    
    updateCopySelectedButton();
}

// 全选/取消全选随机推荐链接
function toggleSelectAllRandom() {
    const checkboxes = document.querySelectorAll('#random-links .link-select');
    
    // 检查是否所有随机推荐链接都已选中
    const allRandomSelected = Array.from(checkboxes).every(checkbox => 
        selectedRandomLinks.has(checkbox.value)
    );
    
    if (allRandomSelected) {
        // 取消全选
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            selectedRandomLinks.delete(checkbox.value);
        });
    } else {
        // 全选
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedRandomLinks.add(checkbox.value);
        });
    }
}

// 更新复制链接按钮状态 - 修复首次添加链接后按钮状态不更新的问题
function updateCopySelectedButton() {
    // 检查按钮元素是否存在，避免DOM尚未完全加载时出错
    if (elements.copySelectedBtn) {
        // 只要有存储的链接，就启用复制按钮
        elements.copySelectedBtn.disabled = youtubeLinksItems.length === 0;
        
        // 更新按钮样式
        if (elements.copySelectedBtn.disabled) {
            elements.copySelectedBtn.classList.add('disabled');
        } else {
            elements.copySelectedBtn.classList.remove('disabled');
        }
    }
}

// 获取当前页的链接
function getCurrentPageLinks() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return youtubeLinksItems.slice(startIndex, endIndex);
}

// 获取总页数
function getTotalPages() {
    return Math.ceil(youtubeLinksItems.length / itemsPerPage);
}

// 渲染分页控件
function renderPagination() {
    const totalPages = getTotalPages();
    
    if (totalPages <= 1) {
        // 如果只有一页或没有链接，隐藏分页导航控件
        if (document.getElementById('pagination-container')) {
            document.getElementById('pagination-container').remove();
        }
        
        // 如果没有链接，不需要显示额外的分页操作按钮
        
        return;
    }
    
    // 检查是否已存在分页导航容器
    let paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) {
        // 创建分页容器
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-container';
        paginationContainer.className = 'pagination-container';
        
        // 插入到storedLinksContainer之后
        elements.storedLinksContainer.parentNode.insertBefore(
            paginationContainer,
            elements.storedLinksContainer.nextSibling
        );
    }
    
    // 清空现有内容
    paginationContainer.innerHTML = '';
    
    // 创建分页按钮
    const paginationInfo = document.createElement('span');
    paginationInfo.className = 'pagination-info';
    paginationInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    paginationContainer.appendChild(paginationInfo);
    
    const paginationButtons = document.createElement('div');
    paginationButtons.className = 'pagination-buttons';
    
    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn pagination-btn';
    prevBtn.innerHTML = '<i class="fa fa-chevron-left" aria-hidden="true"></i> 上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderStoredLinks();
            renderPagination();
        }
    });
    paginationButtons.appendChild(prevBtn);
    
    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn pagination-btn';
    nextBtn.innerHTML = '下一页 <i class="fa fa-chevron-right" aria-hidden="true"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderStoredLinks();
            renderPagination();
        }
    });
    paginationButtons.appendChild(nextBtn);
    
    paginationContainer.appendChild(paginationButtons);
}

// 复制已选链接 - 确保只复制用户手动选中的链接
function copySelectedLinks() {
    if (selectedLinks.size === 0) {
        showStatusMessage('请先选择要复制的链接', 'error');
        return;
    }
    
    const linksArray = Array.from(selectedLinks);
    copyToClipboard(linksArray)
        .then(() => {
            // 复制成功的反馈已在copyToClipboard函数中处理
        })
        .catch(() => {
            showStatusMessage('复制失败，请重试', 'error');
        });
}

// 删除链接
async function deleteLink(link) {
    console.log('尝试删除链接:', link);
    // 确保链接不为空
    if (!link) {
        console.error('链接为空');
        showStatusMessage('无效的链接', 'error');
        return;
    }
    
    if (confirm(`确定要删除链接: ${link} 吗？`)) {
        // 从数组中删除链接
        const index = youtubeLinksItems.findIndex(item => item.url === link);
        console.log('找到的索引:', index);
        if (index !== -1) {
            youtubeLinksItems.splice(index, 1);
            console.log('链接已从数组中删除');
            
            // 从已选链接中移除
            selectedLinks.delete(link);
            
            // 保存到服务器和本地存储，静默保存不显示通知
            await saveLinks(youtubeLinksItems, true);
            
            // 更新UI
            renderStoredLinks();
            generateRandomRecommendations();
            updateStats();
            updateCopySelectedButton();
            
            // 显示成功消息
            showStatusMessage('链接已删除！', 'info');
        } else {
            console.log('未找到链接:', link);
            showStatusMessage('未找到链接，删除失败', 'error');
        }
    }
}

// 清空所有链接
async function clearAllLinks() {
    if (youtubeLinksItems.length === 0) {
        showStatusMessage('没有链接可清空', 'error');
        return;
    }
    
    // 先询问确认，只有用户确认后才执行清空操作
    const userConfirmed = confirm('确定要清空所有链接吗？此操作不可恢复！');
    
    if (userConfirmed) {
        // 清空链接数组
        youtubeLinksItems = [];
        
        // 清空已选链接
        selectedLinks.clear();
        
        // 保存到服务器和本地存储
    await saveLinks();
        
        // 更新UI
        renderStoredLinks();
        generateRandomRecommendations();
        updateStats();
        updateCopySelectedButton();
        
        // 自动调整输入框高度
        elements.youtubeLinkInput.style.height = 'auto';
        elements.youtubeLinkInput.style.height = (elements.youtubeLinkInput.scrollHeight) + 'px';
        
        // 显示成功消息
        showStatusMessage('所有链接已清空！', 'success');
    }
}

// 渲染已存储链接列表
function renderStoredLinks() {
    // 清空容器
    elements.storedLinksList.innerHTML = '';
    
    // 如果没有链接，显示空状态
    if (youtubeLinksItems.length === 0) {
        elements.storedLinksList.innerHTML = '<div class="empty-state">暂无存储的链接</div>';
        renderPagination(); // 更新分页控件
        return;
    }
    
    // 获取当前页的链接
    const currentPageLinks = getCurrentPageLinks();
    
    // 渲染当前页的链接列表
    currentPageLinks.forEach(linkItem => {
        const linkElement = createLinkElement(linkItem);
        elements.storedLinksList.appendChild(linkElement);
    });
    
    // 渲染分页控件
    renderPagination();
}

// 全选当前页链接
function selectAllCurrentPage() {
    const currentPageLinks = getCurrentPageLinks();
    const checkboxes = document.querySelectorAll('#stored-links .link-select');
    
    // 检查是否所有可见链接都已选中
    const allVisibleSelected = currentPageLinks.every(linkItem => 
        selectedLinks.has(linkItem.url)
    );
    
    if (allVisibleSelected) {
        // 取消全选当前页
        checkboxes.forEach(checkbox => {
            if (currentPageLinks.some(linkItem => linkItem.url === checkbox.value)) {
                checkbox.checked = false;
                selectedLinks.delete(checkbox.value);
            }
        });
    } else {
        // 全选当前页
        checkboxes.forEach(checkbox => {
            if (currentPageLinks.some(linkItem => linkItem.url === checkbox.value)) {
                checkbox.checked = true;
                selectedLinks.add(checkbox.value);
            }
        });
    }
    
    updateCopySelectedButton();
}

// 复制当前页链接
function copyCurrentPageLinks() {
    const currentPageLinks = getCurrentPageLinks();
    if (currentPageLinks.length === 0) {
        showStatusMessage('当前页没有链接可复制', 'error');
        return;
    }
    
    const linksArray = currentPageLinks.map(linkItem => linkItem.url);
    copyToClipboard(linksArray);
    showStatusMessage(`成功复制 ${linksArray.length} 个链接`, 'success');
}

// 删除当前页链接
async function deleteCurrentPageLinks() {
    const currentPageLinks = getCurrentPageLinks();
    if (currentPageLinks.length === 0) {
        showStatusMessage('当前页没有链接可删除', 'error');
        return;
    }
    
    if (confirm(`确定要删除当前页的 ${currentPageLinks.length} 个链接吗？此操作不可恢复！`)) {
        // 获取当前页链接的URL集合
        const pageLinkUrls = new Set(currentPageLinks.map(linkItem => linkItem.url));
        
        // 从链接数组中删除当前页的链接
        youtubeLinksItems = youtubeLinksItems.filter(linkItem => 
            !pageLinkUrls.has(linkItem.url)
        );
        
        // 从已选链接中移除
        pageLinkUrls.forEach(url => selectedLinks.delete(url));
        
        // 保存到服务器和本地存储
        await saveLinks();
        
        // 更新UI
        renderStoredLinks();
        generateRandomRecommendations();
        updateStats();
        updateCopySelectedButton();
        
        showStatusMessage(`成功删除 ${currentPageLinks.length} 个链接`, 'success');
    }
}

// 切换已存储链接列表显示/隐藏
function toggleStoredLinks() {
    const isExpanded = elements.storedLinksContainer.style.maxHeight !== '0px';
    
    if (isExpanded) {
        elements.storedLinksContainer.style.maxHeight = '0px';
        elements.toggleListBtn.innerHTML = '<i class="fa fa-chevron-down" aria-hidden="true"></i>';
    } else {
        // 设置足够大的高度来显示所有内容
        elements.storedLinksContainer.style.maxHeight = elements.storedLinksList.scrollHeight + 'px';
        elements.toggleListBtn.innerHTML = '<i class="fa fa-chevron-up" aria-hidden="true"></i>';
    }
}

// 更新统计信息
function updateStats() {
    try {
        const count = youtubeLinksItems.length;
        // 使用span标签包裹数字，便于CSS样式化
        const countHtml = `已存储: <span class="count-number">${count}</span> 个链接`;
        
        // 更新所有计数显示位置
        const headerCount = document.getElementById('header-count');
        if (headerCount) {
            headerCount.innerHTML = countHtml;
        }
        
        const storedCount = document.getElementById('stored-count');
        if (storedCount) {
            storedCount.innerHTML = countHtml;
        }
    } catch (error) {
        console.error('更新统计信息时出错:', error);
    }
}

// 格式化时间戳
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

// 数字补零
function padZero(num) {
    return num.toString().padStart(2, '0');
}

// 数组随机排序
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 初始化主题
function initTheme() {
    try {
        const themeKey = getConfig('storage.keys.theme', 'theme_preference');
        const savedTheme = localStorage.getItem(themeKey);
        const isDarkTheme = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
            elements.toggleThemeBtn.innerHTML = '<i class="fa fa-moon-o" aria-hidden="true"></i> 切换主题';
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
            elements.toggleThemeBtn.innerHTML = '<i class="fa fa-sun-o" aria-hidden="true"></i> 切换主题';
        }
        
        // 确保随机推荐链接的颜色正确
        updateRandomLinksColor();
    } catch (error) {
        console.error('Error initializing theme:', error);
    }
}

// 切换主题
function toggleTheme() {
    try {
        const themeKey = getConfig('storage.keys.theme', 'theme_preference');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        
        if (isDarkTheme) {
            // 切换到浅色主题
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            elements.toggleThemeBtn.innerHTML = '<i class="fa fa-sun-o" aria-hidden="true"></i> 切换主题';
            localStorage.setItem(themeKey, 'light');
        } else {
            // 切换到深色主题
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            elements.toggleThemeBtn.innerHTML = '<i class="fa fa-moon-o" aria-hidden="true"></i> 切换主题';
            localStorage.setItem(themeKey, 'dark');
        }
        
        // 更新随机推荐链接的颜色
        updateRandomLinksColor();
    } catch (error) {
        console.error('Error toggling theme:', error);
    }
}

// 更新随机推荐链接的颜色以适应主题
function updateRandomLinksColor() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const linksTextarea = document.querySelector('.random-links-textarea');
    
    if (linksTextarea) {
        linksTextarea.style.color = isDarkTheme ? '#ffffff' : '#000000';
        linksTextarea.style.backgroundColor = isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'; // 为白色主题添加浅色背景
        linksTextarea.style.border = '1px solid ' + (isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)');
    }
}

// 绑定事件监听器
function bindEventListeners() {
    // 移除任何可能存在的旧事件监听器，避免冲突
    document.removeEventListener('click', handleDeleteButtonClick);
    
    // 为了保险起见，添加一个全局的事件监听器来捕获所有删除按钮点击
    // 这将作为直接绑定的补充，确保删除功能一定能工作
    async function handleDeleteButtonClick(e) {
        if (e.target.closest('.delete-btn')) {
            const deleteBtn = e.target.closest('.delete-btn');
            const link = deleteBtn.dataset.link;
            if (link) {
                console.log('通过全局事件监听器捕获到删除按钮点击:', link);
                // 直接执行异步删除操作
                await deleteLink(link);
            }
        }
    }
    
    document.addEventListener('click', handleDeleteButtonClick);
    // 添加链接按钮
    elements.addLinkBtn.addEventListener('click', async () => {
        await addNewLink();
    });
    
    // 格式化链接按钮
    elements.formatLinksBtn.addEventListener('click', formatLinks);
    
    // 回车键添加链接
    elements.youtubeLinkInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await addNewLink();
        }
    });
    
    // 输入事件 - 自动调整输入框高度
    elements.youtubeLinkInput.addEventListener('input', () => {
        elements.youtubeLinkInput.style.height = 'auto';
        elements.youtubeLinkInput.style.height = (elements.youtubeLinkInput.scrollHeight) + 'px';
    });
    
    // 刷新随机推荐按钮
    elements.refreshRandomBtn.addEventListener('click', generateRandomRecommendations);
    
    // 清空所有链接按钮
    elements.clearAllBtn.addEventListener('click', async () => {
        await clearAllLinks();
    });
    
    // 复制随机推荐链接按钮
    elements.copySelectedBtn.addEventListener('click', copyAllRandomLinks);
    
    // 切换已存储链接列表显示/隐藏
    elements.toggleListBtn.addEventListener('click', toggleStoredLinks);
    
    // 移除全选按钮相关事件 - 因为按钮已删除
    
    // 为随机推荐区域添加全选按钮事件监听
    document.addEventListener('click', (e) => {
        if (e.target.closest('#random-links-select-all')) {
            toggleSelectAllRandom();
        }
    });
    
    // 主题切换按钮
    elements.toggleThemeBtn.addEventListener('click', toggleTheme);
    
    // 移除一键复制按钮事件监听 - 因为按钮已删除
    
    // 已存储链接功能按钮
    if (elements.selectAllBtn) {
        elements.selectAllBtn.addEventListener('click', selectAllCurrentPage);
    }
    if (elements.copyLinksBtn) {
        elements.copyLinksBtn.addEventListener('click', () => {
            // 根据选中的链接数量决定复制选中项还是当前页
            if (selectedLinks.size > 0) {
                copySelectedLinks();
            } else {
                copyCurrentPageLinks();
            }
        });
    }
    if (elements.deleteLinksBtn) {
        elements.deleteLinksBtn.addEventListener('click', async () => {
            // 根据选中的链接数量决定删除选中项还是当前页
            if (selectedLinks.size > 0) {
                // 删除选中的链接
                if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？此操作不可恢复！`)) {
                    const linksToDelete = Array.from(selectedLinks);
                    
                    // 从数组中删除选中的链接
                    youtubeLinksItems = youtubeLinksItems.filter(linkItem => 
                        !linksToDelete.includes(linkItem.url)
                    );
                    
                    // 清空选中链接集合
                    selectedLinks.clear();
                    
                    // 静默保存
                    await saveLinks(youtubeLinksItems, true);
                    
                    // 更新UI
                    renderStoredLinks();
                    generateRandomRecommendations();
                    updateStats();
                    updateCopySelectedButton();
                    
                    showStatusMessage(`成功删除 ${linksToDelete.length} 个链接`, 'info');
                }
            } else {
                // 如果没有选中的链接，则删除当前页
                await deleteCurrentPageLinks();
            }
        });
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);
