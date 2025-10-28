const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'youtube_links.json');

// 创建data目录（如果不存在）
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据文件（如果不存在）
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ links: [] }));
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 获取所有链接
app.get('/api/links', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data.links || []);
  } catch (error) {
    console.error('Error reading links:', error);
    res.status(500).json({ error: 'Failed to read links' });
  }
});

// 添加链接
app.post('/api/links', (req, res) => {
  try {
    const newLinks = req.body.links || [];
    if (!Array.isArray(newLinks)) {
      return res.status(400).json({ error: 'Links must be an array' });
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const existingLinks = data.links || [];
    
    // 去重（基于URL）
    const existingUrls = new Set(existingLinks.map(link => link.url));
    const uniqueNewLinks = newLinks.filter(link => !existingUrls.has(link.url));
    
    const updatedLinks = [...existingLinks, ...uniqueNewLinks];
    
    fs.writeFileSync(DATA_FILE, JSON.stringify({ links: updatedLinks }));
    
    res.json({
      message: 'Links added successfully',
      addedCount: uniqueNewLinks.length,
      totalCount: updatedLinks.length
    });
  } catch (error) {
    console.error('Error adding links:', error);
    res.status(500).json({ error: 'Failed to add links' });
  }
});

// 删除链接
app.delete('/api/links/:id', (req, res) => {
  try {
    const linkId = req.params.id;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const existingLinks = data.links || [];
    
    const updatedLinks = existingLinks.filter(link => link.id !== linkId);
    
    fs.writeFileSync(DATA_FILE, JSON.stringify({ links: updatedLinks }));
    
    res.json({
      message: 'Link deleted successfully',
      totalCount: updatedLinks.length
    });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// 清空所有链接
app.delete('/api/links', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ links: [] }));
    res.json({ message: 'All links cleared successfully' });
  } catch (error) {
    console.error('Error clearing links:', error);
    res.status(500).json({ error: 'Failed to clear links' });
  }
});

// 提供前端页面
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});