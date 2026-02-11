// Sketchboard Viewer - Infinite canvas with direct manipulation
// Design: Dark industrial aesthetic with glowing accents

export function renderViewer(canvasId: string, wsUrl: string, darkMode: boolean = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sketchboard · ${canvasId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-deep: #0a0a0f;
      --bg-surface: #12121a;
      --bg-elevated: #1a1a24;
      --border: #2a2a3a;
      --text: #e4e4eb;
      --text-dim: #6b6b7b;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.4);
      --success: #22c55e;
      --warning: #f59e0b;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Space Grotesk', system-ui, sans-serif;
      background: var(--bg-deep);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    /* ═══════════════ TOOLBAR ═══════════════ */
    .toolbar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 2px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;
    }
    
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    
    .toolbar-divider {
      width: 1px;
      height: 28px;
      background: var(--border);
      margin: 0 8px;
    }
    
    .tool-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text-dim);
      font-size: 18px;
      transition: all 0.15s ease;
      position: relative;
    }
    
    .tool-btn:hover {
      background: var(--bg-surface);
      color: var(--text);
    }
    
    .tool-btn.active {
      background: var(--accent);
      color: white;
      box-shadow: 0 0 20px var(--accent-glow);
    }
    
    .tool-btn svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
    }
    
    .tool-btn[data-tooltip]:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-deep);
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      color: var(--text);
      pointer-events: none;
      z-index: 1000;
    }
    
    /* ═══════════════ STATUS BAR ═══════════════ */
    .status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 32px;
      background: var(--bg-surface);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-dim);
      z-index: 100;
    }
    
    .status-left, .status-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-dim);
      transition: all 0.3s;
    }
    
    .status-dot.connected {
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }
    
    .zoom-control {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .zoom-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 14px;
    }
    
    .zoom-btn:hover {
      background: var(--bg-deep);
      color: var(--text);
    }
    
    .zoom-value {
      min-width: 48px;
      text-align: center;
    }
    
    /* ═══════════════ CANVAS ═══════════════ */
    .canvas-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: 
        radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 70%),
        var(--bg-deep);
    }
    
    /* Subtle grid pattern */
    .canvas-wrapper::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(var(--border) 1px, transparent 1px),
        linear-gradient(90deg, var(--border) 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: 0.3;
      pointer-events: none;
    }
    
    .canvas-container {
      position: absolute;
      inset: 0;
    }
    
    .canvas-container > div {
      width: 100%;
      height: 100%;
      transform-origin: center center;
    }
    
    .canvas-container svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    
    /* Cursor states */
    .canvas-wrapper.mode-select { cursor: default; }
    .canvas-wrapper.mode-pan { cursor: grab; }
    .canvas-wrapper.mode-pan.panning { cursor: grabbing; }
    .canvas-wrapper.mode-select.dragging { cursor: move; }
    
    /* ═══════════════ EMPTY STATE ═══════════════ */
    .empty-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      pointer-events: none;
      z-index: 10;
    }
    
    .empty-state.hidden { display: none; }
    
    .empty-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 20px;
      opacity: 0.3;
    }
    
    .empty-state h2 {
      font-size: 20px;
      font-weight: 500;
      color: var(--text-dim);
      margin-bottom: 8px;
    }
    
    .empty-state p {
      font-size: 14px;
      color: var(--text-dim);
      opacity: 0.7;
    }
    
    .empty-state code {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-elevated);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    
    /* ═══════════════ SELECTION ═══════════════ */
    .selection-box {
      stroke: var(--accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      fill: rgba(99, 102, 241, 0.1);
      pointer-events: none;
    }
    
    /* ═══════════════ LIGHT MODE ═══════════════ */
    body.light-mode {
      --bg-deep: #f8f9fa;
      --bg-surface: #ffffff;
      --bg-elevated: #ffffff;
      --border: #e0e0e5;
      --text: #1a1a1f;
      --text-dim: #6b6b7b;
    }
    
    body.light-mode .canvas-wrapper {
      background: 
        radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 70%),
        var(--bg-deep);
    }
    
    body.light-mode .canvas-wrapper::before {
      opacity: 0.5;
    }

    /* ═══════════════ PRO MODE ═══════════════ */
    .canvas-wrapper.pro-mode {
      background: 
        radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.03) 0%, transparent 70%),
        #0f0f1e;
    }
    
    .canvas-wrapper.pro-mode::before {
      background-image: 
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: 1;
    }

    @font-face {
      font-family: 'Virgil';
      src: url('https://excalidraw.com/Virgil.woff2') format('woff2');
    }
  </style>
</head>
<body class="${darkMode ? '' : 'light-mode'}">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="tool-btn active" id="btn-select" data-tooltip="Select (V)" onclick="setMode('select')">
        <svg viewBox="0 0 24 24"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
      </button>
      <button class="tool-btn" id="btn-pan" data-tooltip="Pan (H)" onclick="setMode('pan')">
        <svg viewBox="0 0 24 24"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5m0-7a2 2 0 0 0-2-2a2 2 0 0 0-2 2v9m0-9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10m0-5a2 2 0 0 0-2-2a2 2 0 0 0-2 2v7a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/></svg>
      </button>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group">
      <button class="tool-btn" id="btn-fit" data-tooltip="Fit to view (0)" onclick="resetView()">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>
      </button>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group">
      <button class="tool-btn" id="btn-style" data-tooltip="Toggle style" onclick="toggleStyle()">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.81-.13 2.66-.37A8 8 0 0 0 12 14a8 8 0 0 0 2.66-7.63A10 10 0 0 0 12 2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="tool-btn" id="btn-theme" data-tooltip="Toggle theme" onclick="toggleDark()">
        <svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>
      </button>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group">
      <button class="tool-btn" id="btn-export" data-tooltip="Export SVG" onclick="exportSvg()">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
    </div>
  </div>
  
  <!-- Canvas -->
  <div class="canvas-wrapper mode-select" id="canvas-wrapper">
    <div class="canvas-container">
      <div id="svg-container"></div>
    </div>
    
    <div class="empty-state" id="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 3v18"/>
      </svg>
      <h2>Empty Canvas</h2>
      <p>Use the API to draw: <code>POST /canvas/${canvasId}/draw</code></p>
    </div>
  </div>
  
  <!-- Status Bar -->
  <div class="status-bar">
    <div class="status-left">
      <span class="status-indicator">
        <span class="status-dot" id="status-dot"></span>
        <span id="status-text">Connecting...</span>
      </span>
      <span>Canvas: <strong>${canvasId}</strong></span>
      <span id="shape-count">0 shapes</span>
    </div>
    <div class="status-right">
      <div class="zoom-control">
        <button class="zoom-btn" onclick="zoomOut()">−</button>
        <span class="zoom-value" id="zoom-display">100%</span>
        <button class="zoom-btn" onclick="zoomIn()">+</button>
      </div>
    </div>
  </div>

  <script type="module">
    // ═══════════════ STATE ═══════════════
    let mode = 'select'; // 'select' or 'pan'
    let darkMode = ${darkMode};
    let renderStyle = 'clean';
    let zoom = 1;
    let panX = 0, panY = 0;
    let canvasState = null;
    let contentBounds = { minX: 0, minY: 0, maxX: 1200, maxY: 800 };
    
    // Interaction state
    let isPanning = false;
    let isDragging = false;
    let startX, startY;
    let selectedShape = null;
    let dragStartX, dragStartY;
    let draggedArrows = [];
    let spaceHeld = false;
    
    // DOM elements
    const wrapper = document.getElementById('canvas-wrapper');
    const svgContainer = document.getElementById('svg-container');
    const emptyState = document.getElementById('empty-state');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const shapeCount = document.getElementById('shape-count');
    const zoomDisplay = document.getElementById('zoom-display');
    
    // ═══════════════ WEBSOCKET ═══════════════
    const ws = new WebSocket('${wsUrl}');
    
    ws.onopen = () => {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
    };
    
    ws.onclose = () => {
      statusDot.classList.remove('connected');
      statusText.textContent = 'Disconnected';
      setTimeout(() => location.reload(), 2000);
    };
    
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'state' || data.type === 'update') {
        canvasState = data.canvas;
        shapeCount.textContent = canvasState.shapes.length + ' shapes';
        await loadSvg();
      }
    };
    
    // Keep-alive
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    // ═══════════════ RENDERING ═══════════════
    let initialLoad = true;
    
    async function loadSvg() {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(rect.width * 2, 2400);
      const h = Math.max(rect.height * 2, 1600);
      
      const resp = await fetch('/canvas/${canvasId}/svg?dark=' + darkMode + '&width=' + w + '&height=' + h + '&style=' + renderStyle);
      const svg = await resp.text();
      svgContainer.innerHTML = svg;
      
      const svgEl = svgContainer.querySelector('svg');
      if (svgEl) {
        const vb = svgEl.getAttribute('viewBox')?.split(' ').map(Number);
        if (vb && vb.length === 4) {
          contentBounds = { minX: vb[0], minY: vb[1], maxX: vb[0] + vb[2], maxY: vb[1] + vb[3] };
        }
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      
      if (initialLoad && canvasState?.shapes.length > 0) {
        resetView();
        initialLoad = false;
      }
      
      applyTransform();
      
      const hasShapes = svg.includes('<path') || svg.includes('<ellipse') || svg.includes('<text') || svg.includes('<circle') || svg.includes('<polygon');
      emptyState.classList.toggle('hidden', hasShapes);
      
      // Re-apply selection highlight if shape selected
      if (selectedShape) highlightShape(selectedShape);
    }
    
    function applyTransform() {
      svgContainer.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${zoom})\`;
      zoomDisplay.textContent = Math.round(zoom * 100) + '%';
    }
    
    // ═══════════════ MODE SWITCHING ═══════════════
    window.setMode = (newMode) => {
      mode = newMode;
      document.getElementById('btn-select').classList.toggle('active', mode === 'select');
      document.getElementById('btn-pan').classList.toggle('active', mode === 'pan');
      wrapper.className = 'canvas-wrapper mode-' + mode;
      
      if (mode === 'pan') {
        selectedShape = null;
        highlightShape(null);
      }
    };
    
    // ═══════════════ VIEW CONTROLS ═══════════════
    window.resetView = () => {
      const rect = wrapper.getBoundingClientRect();
      const contentW = contentBounds.maxX - contentBounds.minX;
      const contentH = contentBounds.maxY - contentBounds.minY;
      
      const zoomX = (rect.width * 0.85) / contentW;
      const zoomY = ((rect.height - 64) * 0.85) / contentH;
      zoom = Math.min(zoomX, zoomY, 1.5);
      zoom = Math.max(zoom, 0.1);
      
      panX = 0;
      panY = 0;
      applyTransform();
    };
    
    window.zoomIn = () => { zoom = Math.min(zoom * 1.25, 10); applyTransform(); };
    window.zoomOut = () => { zoom = Math.max(zoom * 0.8, 0.05); applyTransform(); };
    
    window.toggleStyle = () => {
      const cycle = { clean: 'rough', rough: 'pro', pro: 'clean' };
      renderStyle = cycle[renderStyle] || 'clean';
      const btn = document.getElementById('btn-style');
      btn.classList.toggle('active', renderStyle !== 'clean');
      // Update tooltip with current style
      btn.setAttribute('data-tooltip', 'Style: ' + renderStyle);
      // Toggle pro mode background
      wrapper.classList.toggle('pro-mode', renderStyle === 'pro');
      loadSvg();
    };
    
    window.toggleDark = () => {
      darkMode = !darkMode;
      document.body.classList.toggle('light-mode', !darkMode);
      loadSvg();
    };
    
    window.exportSvg = async () => {
      const resp = await fetch('/canvas/${canvasId}/svg?dark=' + darkMode + '&width=1920&height=1080&style=' + renderStyle);
      const svg = await resp.text();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${canvasId}.svg';
      a.click();
      URL.revokeObjectURL(url);
    };
    
    // ═══════════════ COORDINATE TRANSFORMS ═══════════════
    function screenToCanvas(screenX, screenY) {
      const rect = wrapper.getBoundingClientRect();
      const svg = svgContainer.querySelector('svg');
      if (!svg) return { x: 0, y: 0 };
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const relX = screenX - rect.left;
      const relY = screenY - rect.top;
      
      const transformedX = (relX - centerX - panX) / zoom + centerX;
      const transformedY = (relY - centerY - panY) / zoom + centerY;
      
      const vb = svg.getAttribute('viewBox')?.split(' ').map(Number);
      if (!vb || vb.length !== 4) return { x: transformedX, y: transformedY };
      
      const [vbX, vbY, vbW, vbH] = vb;
      const scaleX = vbW / rect.width;
      const scaleY = vbH / rect.height;
      const scale = Math.max(scaleX, scaleY);
      
      return { x: vbX + transformedX * scale, y: vbY + transformedY * scale };
    }
    
    // ═══════════════ SHAPE DETECTION ═══════════════
    function findShapeAt(screenX, screenY) {
      if (!canvasState) return null;
      const { x: cx, y: cy } = screenToCanvas(screenX, screenY);
      
      for (let i = canvasState.shapes.length - 1; i >= 0; i--) {
        const s = canvasState.shapes[i];
        if (s.type === 'text' || s.type === 'line' || s.type === 'arrow') continue;
        
        const w = s.width || 100;
        const h = s.height || 50;
        const pad = 10;
        if (cx >= s.x - pad && cx <= s.x + w + pad && cy >= s.y - pad && cy <= s.y + h + pad) {
          return s;
        }
      }
      return null;
    }
    
    function highlightShape(shape) {
      const existing = svgContainer.querySelector('.selection-box');
      if (existing) existing.remove();
      if (!shape) return;
      
      const svg = svgContainer.querySelector('svg');
      if (!svg) return;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'selection-box');
      rect.setAttribute('x', shape.x - 4);
      rect.setAttribute('y', shape.y - 4);
      rect.setAttribute('width', (shape.width || 100) + 8);
      rect.setAttribute('height', (shape.height || 50) + 8);
      rect.setAttribute('rx', '4');
      svg.appendChild(rect);
    }
    
    // ═══════════════ ARROW BINDING ═══════════════
    function getAnchorPoint(shape, anchor) {
      const w = shape.width || 100;
      const h = shape.height || 50;
      const cx = shape.x + w / 2;
      const cy = shape.y + h / 2;
      
      switch (anchor) {
        case 'top': return { x: cx, y: shape.y };
        case 'bottom': return { x: cx, y: shape.y + h };
        case 'left': return { x: shape.x, y: cy };
        case 'right': return { x: shape.x + w, y: cy };
        default: return { x: cx, y: cy };
      }
    }
    
    function updateBoundArrows(movedShape) {
      if (!canvasState) return [];
      const updated = [];
      
      for (const shape of canvasState.shapes) {
        if (shape.type !== 'arrow') continue;
        let changed = false;
        
        const checkBinding = (binding, pointIndex) => {
          if (!binding) return;
          const id = typeof binding === 'string' ? binding : binding.shapeId;
          if (id !== movedShape.id) return;
          const anchor = typeof binding === 'object' ? binding.anchor : 'auto';
          const pt = getAnchorPoint(movedShape, anchor || 'auto');
          if (shape.points?.[pointIndex]) {
            shape.points[pointIndex] = pt;
            changed = true;
          }
        };
        
        checkBinding(shape.startBinding, 0);
        checkBinding(shape.endBinding, shape.points?.length - 1);
        
        if (changed) updated.push(shape);
      }
      return updated;
    }
    
    // ═══════════════ MOUSE INTERACTION ═══════════════
    wrapper.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      
      // Space+click or pan mode = pan
      if (spaceHeld || mode === 'pan') {
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        wrapper.classList.add('panning');
        e.preventDefault();
        return;
      }
      
      // Select mode - check for shape
      if (mode === 'select') {
        const shape = findShapeAt(e.clientX, e.clientY);
        if (shape) {
          selectedShape = shape;
          isDragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          highlightShape(shape);
          wrapper.classList.add('dragging');
          e.preventDefault();
        } else {
          // Click on empty = deselect and start pan
          selectedShape = null;
          highlightShape(null);
          isPanning = true;
          startX = e.clientX - panX;
          startY = e.clientY - panY;
          wrapper.classList.add('panning');
        }
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging && selectedShape) {
        const rect = wrapper.getBoundingClientRect();
        const svg = svgContainer.querySelector('svg');
        const vb = svg?.getAttribute('viewBox')?.split(' ').map(Number);
        
        let scale = 1;
        if (vb?.length === 4) {
          scale = Math.max(vb[2] / rect.width, vb[3] / rect.height);
        }
        
        const dx = ((e.clientX - dragStartX) / zoom) * scale;
        const dy = ((e.clientY - dragStartY) / zoom) * scale;
        
        selectedShape.x += dx;
        selectedShape.y += dy;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        draggedArrows = updateBoundArrows(selectedShape);
        loadSvg();
      } else if (isPanning) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
      }
    });
    
    document.addEventListener('mouseup', async () => {
      if (isDragging && selectedShape) {
        const shapes = [selectedShape, ...draggedArrows];
        await fetch('/canvas/${canvasId}/draw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', shapes })
        });
        draggedArrows = [];
      }
      
      isDragging = false;
      isPanning = false;
      wrapper.classList.remove('panning', 'dragging');
    });
    
    // ═══════════════ WHEEL ZOOM ═══════════════
    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      const oldZoom = zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.min(Math.max(zoom * delta, 0.05), 10);
      
      const zoomRatio = zoom / oldZoom;
      panX = mouseX - (mouseX - panX) * zoomRatio;
      panY = mouseY - (mouseY - panY) * zoomRatio;
      
      applyTransform();
    }, { passive: false });
    
    // ═══════════════ KEYBOARD ═══════════════
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !spaceHeld) {
        spaceHeld = true;
        wrapper.classList.add('mode-pan');
      }
      if (e.key === 'v' || e.key === 'V') setMode('select');
      if (e.key === 'h' || e.key === 'H') setMode('pan');
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); resetView(); }
      if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); zoomIn(); }
      if (e.key === '-' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); zoomOut(); }
      if (e.key === 'Escape') { selectedShape = null; highlightShape(null); }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        spaceHeld = false;
        wrapper.classList.remove('mode-pan');
      }
    });
    
    // ═══════════════ INIT ═══════════════
    loadSvg();
  </script>
</body>
</html>`;
}
