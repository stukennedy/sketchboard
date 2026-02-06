// HTML viewer with Datastar for live SVG updates

export function renderViewer(canvasId: string, wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sketchboard</title>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@sudodevnull/datastar@1.0.0-beta.11/dist/datastar.min.js"></script>
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
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow: hidden;
    }
    
    .canvas-container {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      overflow: hidden;
      max-width: 100%;
      max-height: 100%;
    }
    
    .canvas-container svg {
      display: block;
      max-width: 100%;
      height: auto;
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
  </style>
</head>
<body data-store='{
  "connected": false,
  "shapeCount": 0,
  "svg": "",
  "lastUpdate": null
}'>
  <header>
    <h1>Sketchboard</h1>
    <div class="status">
      <span class="status-dot" data-class-connected="$connected"></span>
      <span data-text="$connected ? 'Connected' : 'Connecting...'"></span>
    </div>
  </header>
  
  <main>
    <div class="canvas-container" data-show="$svg">
      <div data-html="$svg"></div>
    </div>
    <div class="empty-state" data-show="!$svg">
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
    <span data-text="$shapeCount + ' shapes'"></span>
    <span data-text="$lastUpdate ? 'Updated: ' + $lastUpdate : ''"></span>
  </div>

  <script type="module">
    const ws = new WebSocket('${wsUrl}');
    const store = document.body.dataset;
    
    ws.onopen = () => {
      window.ds.store.connected = true;
    };
    
    ws.onclose = () => {
      window.ds.store.connected = false;
      // Reconnect after 2 seconds
      setTimeout(() => location.reload(), 2000);
    };
    
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'state' || data.type === 'update') {
        const canvas = data.canvas;
        window.ds.store.shapeCount = canvas.shapes.length;
        window.ds.store.lastUpdate = new Date().toLocaleTimeString();
        
        // Fetch rendered SVG
        const resp = await fetch('/canvas/${canvasId}/svg');
        const svg = await resp.text();
        window.ds.store.svg = svg;
      }
    };
    
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
