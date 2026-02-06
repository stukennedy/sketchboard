// Durable Object for canvas state management

import type { CanvasState, Shape, DrawCommand } from '@/types';

export class CanvasDO implements DurableObject {
  private state: DurableObjectState;
  private canvas: CanvasState | null = null;
  private initialCanvas: CanvasState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async loadCanvas(): Promise<CanvasState> {
    if (this.canvas) return this.canvas;
    
    const stored = await this.state.storage.get<CanvasState>('canvas');
    if (stored) {
      this.canvas = stored;
    } else {
      this.canvas = {
        id: this.state.id.toString(),
        shapes: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        backgroundColor: '#ffffff',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.state.storage.put('canvas', this.canvas);
    }
    return this.canvas;
  }

  private async loadInitialCanvas(): Promise<CanvasState | null> {
    if (this.initialCanvas) return this.initialCanvas;
    this.initialCanvas = await this.state.storage.get<CanvasState>('initialCanvas') || null;
    return this.initialCanvas;
  }

  private async saveInitialCanvas(canvas: CanvasState): Promise<void> {
    // Deep clone to avoid reference issues
    this.initialCanvas = JSON.parse(JSON.stringify(canvas));
    await this.state.storage.put('initialCanvas', this.initialCanvas);
  }

  private async saveCanvas(): Promise<void> {
    if (this.canvas) {
      this.canvas.updatedAt = Date.now();
      await this.state.storage.put('canvas', this.canvas);
    }
  }

  private broadcast(message: object): void {
    const json = JSON.stringify(message);
    // Use Cloudflare's WebSocket hibernation API to get all connected sockets
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(json);
      } catch {
        // Socket will be cleaned up automatically
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // WebSocket upgrade for live updates
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Accept with hibernation support
      this.state.acceptWebSocket(server);
      
      // Send current state on connect
      const canvas = await this.loadCanvas();
      server.send(JSON.stringify({ type: 'state', canvas }));
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    const canvas = await this.loadCanvas();
    
    // GET - return current state
    if (request.method === 'GET') {
      return Response.json(canvas);
    }
    
    // POST - apply draw command or special actions
    if (request.method === 'POST') {
      const body = await request.json() as DrawCommand & { action: string };
      
      // Special action: save current state as initial (snapshot)
      if (body.action === 'snapshot') {
        await this.saveInitialCanvas(canvas);
        return Response.json({ ok: true, message: 'Snapshot saved' });
      }
      
      // Special action: reset to initial state
      if (body.action === 'reset') {
        const initial = await this.loadInitialCanvas();
        if (initial) {
          canvas.shapes = JSON.parse(JSON.stringify(initial.shapes));
          canvas.viewport = { ...initial.viewport };
          await this.saveCanvas();
          this.broadcast({ type: 'state', canvas });
          return Response.json({ ok: true, message: 'Reset to initial state', shapeCount: canvas.shapes.length });
        } else {
          return Response.json({ ok: false, message: 'No initial state saved' }, { status: 404 });
        }
      }
      
      const cmd = body as DrawCommand;
      
      switch (cmd.action) {
        case 'add':
          if (cmd.shapes) {
            canvas.shapes.push(...cmd.shapes);
            // Auto-save as initial if this is the first content and no initial exists
            const initial = await this.loadInitialCanvas();
            if (!initial && canvas.shapes.length > 0) {
              await this.saveInitialCanvas(canvas);
            }
          }
          break;
          
        case 'update':
          if (cmd.shapes) {
            for (const updated of cmd.shapes) {
              const idx = canvas.shapes.findIndex(s => s.id === updated.id);
              if (idx >= 0) {
                canvas.shapes[idx] = updated;
              }
            }
          }
          break;
          
        case 'delete':
          if (cmd.shapeIds) {
            canvas.shapes = canvas.shapes.filter(s => !cmd.shapeIds!.includes(s.id));
          }
          break;
          
        case 'clear':
          canvas.shapes = [];
          break;
      }
      
      await this.saveCanvas();
      
      // Broadcast update to all connected clients
      this.broadcast({ type: 'update', cmd, canvas });
      
      return Response.json({ ok: true, shapeCount: canvas.shapes.length });
    }
    
    // PUT - replace entire canvas
    if (request.method === 'PUT') {
      const newCanvas = await request.json() as Partial<CanvasState>;
      if (newCanvas.shapes) canvas.shapes = newCanvas.shapes;
      if (newCanvas.viewport) canvas.viewport = newCanvas.viewport;
      if (newCanvas.backgroundColor) canvas.backgroundColor = newCanvas.backgroundColor;
      
      await this.saveCanvas();
      this.broadcast({ type: 'state', canvas });
      
      return Response.json({ ok: true });
    }
    
    // DELETE - clear canvas
    if (request.method === 'DELETE') {
      canvas.shapes = [];
      await this.saveCanvas();
      this.broadcast({ type: 'state', canvas });
      
      return Response.json({ ok: true });
    }
    
    return new Response('Method not allowed', { status: 405 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Handle incoming WebSocket messages if needed
    try {
      const data = JSON.parse(message as string);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // Ignore parse errors
    }
  }

  webSocketClose(ws: WebSocket): void {
    // Cloudflare handles cleanup automatically
  }

  webSocketError(ws: WebSocket): void {
    // Cloudflare handles cleanup automatically
  }
}
