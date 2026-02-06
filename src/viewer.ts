// HTML viewer with Datastar for live SVG updates

export function renderViewer(canvasId: string, wsUrl: string, darkMode: boolean = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sketchboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    header {
      background: #16213e;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #0f3460;
    }
    
    header h1 {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    header h1::before {
      content: '✏️';
    }
    
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #888;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      transition: background 0.3s;
    }
    
    .status-dot.connected {
      background: #4ade80;
    }
    
    main {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }
    
    .canvas-container {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    
    .canvas-container svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    
    .info-bar {
      background: #16213e;
      padding: 8px 20px;
      font-size: 12px;
      color: #666;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #0f3460;
    }
    
    .empty-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #666;
      padding: 60px;
    }
    
    .empty-state h2 {
      font-size: 24px;
      margin-bottom: 12px;
    }
    
    .empty-state p {
      font-size: 14px;
      max-width: 400px;
    }
    
    .empty-state code {
      background: #0f3460;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    @font-face {
      font-family: 'Virgil';
      src: url('https://excalidraw.com/Virgil.woff2') format('woff2');
    }
    
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .ctrl-btn {
      background: #0f3460;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 16px;
      color: #fff;
    }
    
    .ctrl-btn:hover {
      background: #1a4a80;
    }
    
    .zoom-display {
      font-size: 12px;
      color: #888;
      min-width: 40px;
    }
    
    .canvas-container {
      cursor: grab;
    }
    
    .canvas-container > div {
      transition: transform 0.05s ease-out;
    }
    
    /* Light mode overrides */
    body.light-mode {
      background: #f5f5f5;
      color: #333;
    }
    
    body.light-mode header,
    body.light-mode .info-bar {
      background: #fff;
      border-color: #ddd;
    }
    
    body.light-mode .theme-toggle {
      background: #e0e0e0;
    }
    
    body.light-mode .empty-state {
      color: #888;
    }
  </style>
</head>
<body>
  <header>
    <h1>Sketchboard</h1>
    <div class="controls">
      <button onclick="resetView()" class="ctrl-btn" title="Reset view (Cmd+0)">⌂</button>
      <span id="zoom-display" class="zoom-display">100%</span>
      <button onclick="toggleEdit()" class="ctrl-btn" id="edit-btn" title="Edit mode">🔒</button>
      <button onclick="toggleStyle()" class="ctrl-btn" id="style-btn" title="Toggle style">✨</button>
      <button onclick="toggleDark()" class="ctrl-btn" title="Toggle theme">🌙</button>
      <button onclick="exportSvg()" class="ctrl-btn" title="Export SVG">⬇️</button>
      <button onclick="resetCanvas()" class="ctrl-btn" title="Reset canvas">🔄</button>
      <div class="status">
        <span class="status-dot"></span>
        <span>Connecting...</span>
      </div>
    </div>
  </header>
  
  <main>
    <div class="canvas-container" style="display:none">
      <div></div>
    </div>
    <div class="empty-state">
      <h2>Waiting for drawings...</h2>
      <p>
        The canvas is empty. Use the API to draw shapes:
        <br><br>
        <code>POST /canvas/${canvasId}/draw</code>
      </p>
    </div>
  </main>
  
  <div class="info-bar">
    <span>Canvas: <code>${canvasId}</code></span>
    <span>0 shapes</span>
    <span></span>
  </div>

  <script type="module">
    const ws = new WebSocket('${wsUrl}');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status span:last-child');
    const canvasContainer = document.querySelector('.canvas-container');
    const emptyState = document.querySelector('.empty-state');
    const svgContainer = canvasContainer.querySelector('div');
    const shapeCountEl = document.querySelector('.info-bar span:nth-child(2)');
    const lastUpdateEl = document.querySelector('.info-bar span:nth-child(3)');
    const zoomDisplay = document.getElementById('zoom-display');
    
    let darkMode = ${darkMode};
    let renderStyle = 'clean'; // 'rough' or 'clean'
    let editMode = false;
    let zoom = 1;
    let panX = 0, panY = 0;
    let isPanning = false;
    let startX, startY;
    let selectedShape = null;
    let isDragging = false;
    let dragStartX, dragStartY;
    let canvasState = null; // Stores shape data for editing
    
    let initialLoad = true;
    let contentBounds = { minX: 0, minY: 0, maxX: 1200, maxY: 800 };
    
    async function loadSvg() {
      const rect = canvasContainer.getBoundingClientRect();
      // Request larger canvas to allow for infinite canvas feel
      const w = Math.max(rect.width * 2, 2400);
      const h = Math.max(rect.height * 2, 1600);
      const resp = await fetch('/canvas/${canvasId}/svg?dark=' + darkMode + '&width=' + w + '&height=' + h + '&style=' + renderStyle);
      const svg = await resp.text();
      svgContainer.innerHTML = svg;
      
      // Extract viewBox to understand content bounds
      const svgEl = svgContainer.querySelector('svg');
      if (svgEl) {
        const vb = svgEl.getAttribute('viewBox')?.split(' ').map(Number);
        if (vb && vb.length === 4) {
          contentBounds = { minX: vb[0], minY: vb[1], maxX: vb[0] + vb[2], maxY: vb[1] + vb[3] };
        }
        // Make SVG fill the container and be responsive
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      
      // Center view on first load
      if (initialLoad && canvasState && canvasState.shapes.length > 0) {
        centerOnContent();
        initialLoad = false;
      }
      
      applyTransform();
      const hasShapes = svg.includes('<path') || svg.includes('<ellipse') || svg.includes('<text') || svg.includes('<circle') || svg.includes('<polygon');
      canvasContainer.style.display = hasShapes ? 'block' : 'none';
      emptyState.style.display = hasShapes ? 'none' : 'flex';
    }
    
    function centerOnContent() {
      // Center view on the content
      const rect = canvasContainer.getBoundingClientRect();
      const contentCenterX = (contentBounds.minX + contentBounds.maxX) / 2;
      const contentCenterY = (contentBounds.minY + contentBounds.maxY) / 2;
      // Pan will be calculated during applyTransform - just reset to center
      panX = 0;
      panY = 0;
      zoom = 1;
    }
    
    function applyTransform() {
      const svg = svgContainer.querySelector('svg');
      if (svg) {
        svgContainer.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
        svgContainer.style.transformOrigin = 'center center';
      }
      if (zoomDisplay) zoomDisplay.textContent = Math.round(zoom * 100) + '%';
    }
    
    // Zoom with mouse wheel - zoom towards cursor position
    canvasContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvasContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      const oldZoom = zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.min(Math.max(zoom * delta, 0.05), 10); // Allow more zoom range
      
      // Adjust pan to zoom towards cursor
      const zoomRatio = zoom / oldZoom;
      panX = mouseX - (mouseX - panX) * zoomRatio;
      panY = mouseY - (mouseY - panY) * zoomRatio;
      
      applyTransform();
    }, { passive: false });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        resetView();
      }
      if (e.key === '1' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoom = 1; panX = 0; panY = 0;
        applyTransform();
      }
      if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoom = Math.min(zoom * 1.2, 10);
        applyTransform();
      }
      if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        zoom = Math.max(zoom * 0.8, 0.05);
        applyTransform();
      }
    });
    
    // Toggle dark mode
    window.toggleDark = () => {
      darkMode = !darkMode;
      document.body.classList.toggle('light-mode', !darkMode);
      loadSvg();
    };
    
    // Reset view - fit content to viewport
    window.resetView = () => {
      const rect = canvasContainer.getBoundingClientRect();
      const contentW = contentBounds.maxX - contentBounds.minX;
      const contentH = contentBounds.maxY - contentBounds.minY;
      
      // Calculate zoom to fit content with some padding
      const zoomX = (rect.width * 0.9) / contentW;
      const zoomY = (rect.height * 0.9) / contentH;
      zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in past 100%
      zoom = Math.max(zoom, 0.05); // Minimum zoom
      
      panX = 0;
      panY = 0;
      applyTransform();
    };
    
    // Toggle render style
    window.toggleStyle = () => {
      renderStyle = renderStyle === 'rough' ? 'clean' : 'rough';
      document.getElementById('style-btn').textContent = renderStyle === 'rough' ? '✏️' : '✨';
      loadSvg();
    };
    
    // Export SVG
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
    
    // Toggle edit mode
    window.toggleEdit = () => {
      editMode = !editMode;
      document.getElementById('edit-btn').textContent = editMode ? '✏️' : '🔒';
      canvasContainer.style.cursor = editMode ? 'crosshair' : 'grab';
      if (!editMode) {
        selectedShape = null;
        highlightShape(null);
      }
    };
    
    // Reset canvas to saved state
    window.resetCanvas = async () => {
      if (confirm('Reset all shape positions?')) {
        // Reload from server
        location.reload();
      }
    };
    
    // Convert screen coords to canvas coords
    function screenToCanvas(screenX, screenY) {
      const rect = canvasContainer.getBoundingClientRect();
      const svg = svgContainer.querySelector('svg');
      if (!svg) return { x: 0, y: 0 };
      
      // Get container center (transform origin)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Mouse position relative to container
      const relX = screenX - rect.left;
      const relY = screenY - rect.top;
      
      // Account for pan and zoom (transform origin is center)
      const transformedX = (relX - centerX - panX) / zoom + centerX;
      const transformedY = (relY - centerY - panY) / zoom + centerY;
      
      // Map to SVG viewBox coordinates
      const vb = svg.getAttribute('viewBox')?.split(' ').map(Number);
      if (!vb || vb.length !== 4) return { x: transformedX, y: transformedY };
      
      const [vbX, vbY, vbW, vbH] = vb;
      const svgRect = svg.getBoundingClientRect();
      
      // Calculate how SVG is scaled/positioned within its container
      const scaleX = vbW / rect.width;
      const scaleY = vbH / rect.height;
      const scale = Math.max(scaleX, scaleY); // preserveAspectRatio: meet
      
      const canvasX = vbX + transformedX * scale;
      const canvasY = vbY + transformedY * scale;
      
      return { x: canvasX, y: canvasY };
    }
    
    // Find shape at position
    function findShapeAt(screenX, screenY) {
      if (!canvasState) return null;
      
      const { x: cx, y: cy } = screenToCanvas(screenX, screenY);
      
      // Check shapes in reverse order (top to bottom)
      for (let i = canvasState.shapes.length - 1; i >= 0; i--) {
        const s = canvasState.shapes[i];
        if (s.type === 'text' || s.type === 'line' || s.type === 'arrow') continue;
        
        const w = s.width || 100;
        const h = s.height || 50;
        // Add some padding for easier selection
        const padding = 10;
        if (cx >= s.x - padding && cx <= s.x + w + padding && 
            cy >= s.y - padding && cy <= s.y + h + padding) {
          return s;
        }
      }
      return null;
    }
    
    // Get anchor point on a shape
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
        case 'center': return { x: cx, y: cy };
        default: return { x: cx, y: cy };
      }
    }
    
    // Update all arrows bound to a shape
    function updateBoundArrows(movedShape) {
      if (!canvasState) return [];
      const updatedArrows = [];
      
      for (const shape of canvasState.shapes) {
        if (shape.type !== 'arrow') continue;
        
        let updated = false;
        const arrow = shape;
        
        // Check start binding
        const startBinding = arrow.startBinding;
        if (startBinding) {
          const bindingId = typeof startBinding === 'string' ? startBinding : startBinding.shapeId;
          if (bindingId === movedShape.id) {
            const anchor = typeof startBinding === 'object' ? startBinding.anchor : 'auto';
            const anchorPoint = getAnchorPoint(movedShape, anchor || 'auto');
            if (arrow.points && arrow.points.length > 0) {
              arrow.points[0] = anchorPoint;
              updated = true;
            }
          }
        }
        
        // Check end binding
        const endBinding = arrow.endBinding;
        if (endBinding) {
          const bindingId = typeof endBinding === 'string' ? endBinding : endBinding.shapeId;
          if (bindingId === movedShape.id) {
            const anchor = typeof endBinding === 'object' ? endBinding.anchor : 'auto';
            const anchorPoint = getAnchorPoint(movedShape, anchor || 'auto');
            if (arrow.points && arrow.points.length > 0) {
              arrow.points[arrow.points.length - 1] = anchorPoint;
              updated = true;
            }
          }
        }
        
        if (updated) {
          updatedArrows.push(arrow);
        }
      }
      
      return updatedArrows;
    }
    
    // Highlight selected shape
    function highlightShape(shape) {
      // Remove existing highlight
      const existing = svgContainer.querySelector('.shape-highlight');
      if (existing) existing.remove();
      
      if (!shape) return;
      
      const svg = svgContainer.querySelector('svg');
      if (!svg) return;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'shape-highlight');
      rect.setAttribute('x', shape.x - 3);
      rect.setAttribute('y', shape.y - 3);
      rect.setAttribute('width', (shape.width || 100) + 6);
      rect.setAttribute('height', (shape.height || 50) + 6);
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#3b82f6');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '5 3');
      svg.appendChild(rect);
    }
    
    // Track shapes being updated during drag
    let draggedArrows = [];
    
    // Edit mode mouse handlers
    canvasContainer.addEventListener('mousedown', (e) => {
      if (editMode) {
        const shape = findShapeAt(e.clientX, e.clientY);
        if (shape) {
          selectedShape = shape;
          isDragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          highlightShape(shape);
          e.preventDefault();
          return;
        }
      }
      // Normal pan behavior (also allow in edit mode with right click or no shape)
      if (e.button === 0 || e.button === 1) {
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        canvasContainer.style.cursor = 'grabbing';
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging && selectedShape) {
        // Convert screen delta to canvas delta
        const rect = canvasContainer.getBoundingClientRect();
        const svg = svgContainer.querySelector('svg');
        const vb = svg?.getAttribute('viewBox')?.split(' ').map(Number);
        
        // Calculate scale factor
        let scale = 1;
        if (vb && vb.length === 4) {
          const vbW = vb[2], vbH = vb[3];
          scale = Math.max(vbW / rect.width, vbH / rect.height);
        }
        
        const dx = ((e.clientX - dragStartX) / zoom) * scale;
        const dy = ((e.clientY - dragStartY) / zoom) * scale;
        
        selectedShape.x += dx;
        selectedShape.y += dy;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        // Update bound arrows
        draggedArrows = updateBoundArrows(selectedShape);
        
        loadSvg().then(() => highlightShape(selectedShape));
      } else if (isPanning) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
      }
    });
    
    document.addEventListener('mouseup', async () => {
      if (isDragging && selectedShape) {
        // Update moved shape and all bound arrows in one request
        const shapesToUpdate = [selectedShape, ...draggedArrows];
        await fetch('/canvas/${canvasId}/draw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            shapes: shapesToUpdate
          })
        });
        isDragging = false;
        draggedArrows = [];
      }
      isPanning = false;
      canvasContainer.style.cursor = editMode ? 'crosshair' : 'grab';
    });
    
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
        shapeCountEl.textContent = canvasState.shapes.length + ' shapes';
        lastUpdateEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
        await loadSvg();
      }
    };
    
    // Load initial SVG
    loadSvg();
    
    // Keep-alive ping
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  </script>
</body>
</html>`;
}
