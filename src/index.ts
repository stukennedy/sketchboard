// Sketchboard - Hand-drawn diagram server for AI agents
// Cloudflare Workers + Hono + Durable Objects + Rough.js

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CanvasDO } from '@/canvas-do';
import { renderToSvg, renderToSvgHtml } from '@/render';
import { renderViewer } from '@/viewer';
import type { CanvasState, Shape, DrawCommand, ExcalidrawFile } from '@/types';

// Re-export DO for wrangler
export { CanvasDO };

interface Env {
  CANVAS: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for API access
app.use('/*', cors());

// Home page - list endpoints
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html>
<head>
  <title>Sketchboard API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #fff; }
    code { background: #0f3460; padding: 2px 8px; border-radius: 4px; }
    pre { background: #16213e; padding: 16px; border-radius: 8px; overflow-x: auto; }
    a { color: #60a5fa; }
    .endpoint { margin: 20px 0; padding: 16px; background: #16213e; border-radius: 8px; }
    .method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-right: 8px; }
    .get { background: #22c55e; color: #000; }
    .post { background: #3b82f6; color: #fff; }
    .delete { background: #ef4444; color: #fff; }
  </style>
</head>
<body>
  <h1>✏️ Sketchboard API</h1>
  <p>Hand-drawn diagram server for AI agents. Use Rough.js aesthetics via simple HTTP API.</p>
  
  <h2>Quick Start</h2>
  <p>Open a canvas viewer: <a href="/canvas/demo">/canvas/demo</a></p>
  
  <h2>Endpoints</h2>
  
  <div class="endpoint">
    <span class="method get">GET</span> <code>/canvas/:id</code>
    <p>Open the live canvas viewer with WebSocket updates</p>
  </div>
  
  <div class="endpoint">
    <span class="method get">GET</span> <code>/canvas/:id/state</code>
    <p>Get canvas state as JSON</p>
  </div>
  
  <div class="endpoint">
    <span class="method get">GET</span> <code>/canvas/:id/svg</code>
    <p>Render canvas to SVG</p>
  </div>
  
  <div class="endpoint">
    <span class="method post">POST</span> <code>/canvas/:id/draw</code>
    <p>Add/update/delete shapes</p>
    <pre>{
  "action": "add",
  "shapes": [
    { "id": "box1", "type": "rectangle", "x": 100, "y": 100, "width": 150, "height": 80, "label": "Server" }
  ]
}</pre>
  </div>
  
  <div class="endpoint">
    <span class="method delete">DELETE</span> <code>/canvas/:id</code>
    <p>Clear all shapes from canvas</p>
  </div>
  
  <h2>Shape Types</h2>
  <pre>
rectangle: { x, y, width, height, label?, strokeColor?, fillColor? }
ellipse:   { x, y, width, height, label?, strokeColor?, fillColor? }
diamond:   { x, y, width, height, label?, strokeColor?, fillColor? }
line:      { x, y, points: [{x,y}, ...], strokeColor? }
arrow:     { x, y, points: [{x,y}, ...], strokeColor? }
text:      { x, y, text, fontSize?, strokeColor? }
  </pre>
  
  <h2>Example: Architecture Diagram</h2>
  <pre>
curl -X POST https://sketchboard.example.com/canvas/demo/draw \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "add",
    "shapes": [
      { "id": "user", "type": "ellipse", "x": 50, "y": 150, "width": 80, "height": 80, "label": "User", "fillColor": "#dbeafe" },
      { "id": "api", "type": "rectangle", "x": 200, "y": 150, "width": 120, "height": 80, "label": "API Server", "fillColor": "#dcfce7" },
      { "id": "db", "type": "rectangle", "x": 400, "y": 150, "width": 120, "height": 80, "label": "Database", "fillColor": "#fef3c7" },
      { "id": "a1", "type": "arrow", "x": 0, "y": 0, "points": [{"x": 130, "y": 190}, {"x": 200, "y": 190}] },
      { "id": "a2", "type": "arrow", "x": 0, "y": 0, "points": [{"x": 320, "y": 190}, {"x": 400, "y": 190}] }
    ]
  }'
  </pre>
</body>
</html>`);
});

// Get canvas stub
function getCanvasStub(c: any, id: string) {
  const doId = c.env.CANVAS.idFromName(id);
  return c.env.CANVAS.get(doId);
}

// Canvas viewer (HTML page with live updates)
app.get('/canvas/:id', async (c) => {
  const id = c.req.param('id');
  const protocol = c.req.url.startsWith('https') ? 'wss' : 'ws';
  const host = c.req.header('host') || 'localhost:8787';
  const wsUrl = `${protocol}://${host}/canvas/${id}/ws`;
  return c.html(renderViewer(id, wsUrl));
});

// WebSocket endpoint for live updates
app.get('/canvas/:id/ws', async (c) => {
  const id = c.req.param('id');
  const stub = getCanvasStub(c, id);
  return stub.fetch(c.req.raw);
});

// Get canvas state as JSON
app.get('/canvas/:id/state', async (c) => {
  const id = c.req.param('id');
  const stub = getCanvasStub(c, id);
  const resp = await stub.fetch(new Request('https://internal/state'));
  return resp;
});

// Render canvas to SVG
app.get('/canvas/:id/svg', async (c) => {
  const id = c.req.param('id');
  const stub = getCanvasStub(c, id);
  const resp = await stub.fetch(new Request('https://internal/state'));
  const state = await resp.json() as CanvasState;
  
  const width = parseInt(c.req.query('width') || '800');
  const height = parseInt(c.req.query('height') || '600');
  const roughness = parseFloat(c.req.query('roughness') || '1');
  
  const svg = renderToSvgHtml(state, { width, height, roughness });
  
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'no-cache'
  });
});

// Draw command (add/update/delete shapes)
app.post('/canvas/:id/draw', async (c) => {
  const id = c.req.param('id');
  const cmd = await c.req.json() as DrawCommand;
  
  // Generate IDs for shapes that don't have them
  if (cmd.shapes) {
    for (const shape of cmd.shapes) {
      if (!shape.id) {
        shape.id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
    }
  }
  
  const stub = getCanvasStub(c, id);
  return stub.fetch(new Request('https://internal/draw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  }));
});

// Replace entire canvas
app.put('/canvas/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const stub = getCanvasStub(c, id);
  return stub.fetch(new Request('https://internal/replace', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
});

// Clear canvas
app.delete('/canvas/:id', async (c) => {
  const id = c.req.param('id');
  const stub = getCanvasStub(c, id);
  return stub.fetch(new Request('https://internal/clear', { method: 'DELETE' }));
});

// Export to Excalidraw format
app.get('/canvas/:id/export/excalidraw', async (c) => {
  const id = c.req.param('id');
  const stub = getCanvasStub(c, id);
  const resp = await stub.fetch(new Request('https://internal/state'));
  const state = await resp.json() as CanvasState;
  
  const excalidraw: ExcalidrawFile = {
    type: 'excalidraw',
    version: 2,
    source: 'sketchboard',
    elements: state.shapes.map(shape => ({
      id: shape.id,
      type: shape.type === 'diamond' ? 'diamond' : shape.type,
      x: shape.x,
      y: shape.y,
      width: 'width' in shape ? shape.width : undefined,
      height: 'height' in shape ? shape.height : undefined,
      points: 'points' in shape ? shape.points.map(p => [p.x, p.y]) : undefined,
      strokeColor: shape.strokeColor || '#1e1e1e',
      backgroundColor: shape.fillColor || 'transparent',
      fillStyle: 'hachure',
      strokeWidth: shape.strokeWidth || 2,
      roughness: 1,
      opacity: shape.opacity ?? 100,
      text: 'text' in shape ? shape.text : ('label' in shape ? shape.label : undefined),
      fontSize: 'fontSize' in shape ? shape.fontSize : 20,
      fontFamily: 1
    })),
    appState: {
      viewBackgroundColor: state.backgroundColor || '#ffffff'
    }
  };
  
  return c.json(excalidraw);
});

export default app;
