# @jackiezhengchina/image-viewer

一个简洁强大的网页图片查看器，支持键盘/鼠标手势、全屏、缩放、旋转、拖拽等功能。

## 📦 CDN（全球加速）

jsDelivr:
```html
<script src="https://cdn.jsdelivr.net/npm/@jackiezhengchina/image-viewer@1.0.2/dist/image-viewer.min.js"></script>
```

unpkg:
```html
<script src="https://unpkg.com/@jackiezhengchina/image-viewer@1.0.2/dist/image-viewer.min.js"></script>
```

## Install

npm:
```bash
npm install @jackiezhengchina/image-viewer
```

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/@jackiezhengchina/image-viewer/dist/image-viewer.css">
</head>
<body>
  <img src="example.jpg" class="image-viewer" alt="示例图片">
  <script src="node_modules/@jackiezhengchina/image-viewer/dist/image-viewer.min.js"></script>
  <script>
    ImageViewer.init('.image-viewer');
  </script>
</body>
</html>
```

## Features

- 🖱️ 鼠标滚轮缩放、双击全屏、右键菜单
- ⌨️ 键盘快捷键（方向键旋转、+/-缩放、F全屏、ESC退出）
- 📱 移动端触摸手势支持
- 🎨 深色/浅色主题跟随系统
- 🌐 支持任意图片格式（支持 CORS 的图床均可）
- 📦 UMD 格式，天然兼容所有前端框架

## API

```js
// 初始化
ImageViewer.init(selector, options);

// 打开指定图片
ImageViewer.open('https://example.com/image.jpg');

// 全屏模式
ImageViewer.toggleFullscreen();

// 销毁
ImageViewer.destroy();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `zoomStep` | number | 0.1 | 每次缩放步进 |
| `maxZoom` | number | 5 | 最大缩放倍数 |
| `minZoom` | number | 0.1 | 最小缩放倍数 |
| `theme` | string | 'auto' | 'light' / 'dark' / 'auto' |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | 放大 |
| `-` | 缩小 |
| `←` `→` | 旋转90° |
| `F` | 全屏 |
| `ESC` | 退出 |
| `R` | 重置视图 |

## License

MIT
