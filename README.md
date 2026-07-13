# @jackiezheng/image-viewer

A lightweight, zero-dependency JavaScript image viewer plugin with zoom, drag, double-click fit, multi-image navigation, and iframe proxy support.

## Features

- 🖼️ **Full-screen Preview** - Click any image to view in fullscreen overlay
- 🔍 **Zoom** - Mouse wheel zoom with configurable step, min/max limits
- 👆 **Drag** - Click and drag to pan zoomed images
- ⚡ **Double-click** - Double-click to fit image to screen
- ⬅️➡️ **Navigation** - Left/right arrows or buttons to switch between images
- ⌨️ **Keyboard Shortcuts** - Escape, Arrow keys, +/-, Home/End
- 📱 **Touch Support** - Touch drag for mobile devices
- 🖼️ **Iframe Proxy** - Automatically injects viewer into same-origin iframes
- 🎯 **Smart Filtering** - Skip small icons/UI decorations (< 150px by default)

## Installation

```bash
npm install @jackiezheng/image-viewer
```

Or include directly:

```html
<script src="dist/image-viewer.min.js"></script>
```

## Usage

### Basic

```html
<img src="photo.jpg" alt="Photo">

<script>
  // Auto-bind on double-click (recommended)
  ImageViewer.config.autoBind = true;
  ImageViewer.init();
</script>
```

### Manual Open

```javascript
// Open specific image
ImageViewer.open(document.querySelector('img'));

// Close viewer
ImageViewer.close();

// Reset to fit screen
ImageViewer.reset();
```

### Configuration

```javascript
ImageViewer.config = {
  zoomStep:   0.12,      // Zoom step per wheel tick
  maxZoom:    8,         // Maximum zoom level
  minZoom:    0.1,       // Minimum zoom level
  initZoom:   0,         // 0 = auto-fit, >0 = fixed initial scale
  overlayBg:  'rgba(0,0,0,.92)',  // Overlay background
  closeColor: '#fff',    // Close button color
  transitionMs: 260,     // Animation duration (ms)
  minPreviewPx: 150,     // Skip images smaller than this
  autoBind:  true,       // Auto-bind double-click listener
};
```

## API

| Method | Description |
|--------|-------------|
| `ImageViewer.open(imgEl)` | Open viewer with specific image |
| `ImageViewer.close()` | Close viewer |
| `ImageViewer.reset()` | Reset zoom and position |
| `ImageViewer.init()` | Initialize iframe proxy (auto-called if autoBind=true) |
| `ImageViewer.config` | Configuration object |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close viewer |
| `←` / `→` | Previous / next image |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Home` | First image |
| `End` | Last image |

## Browser Support

- Chrome, Firefox, Safari, Edge (modern versions)
- IE11 not supported

## License

MIT © JackieZheng
