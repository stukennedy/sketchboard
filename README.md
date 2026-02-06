# Sketchboard

Hand-drawn diagram server for AI agents. Rough.js aesthetics via simple HTTP API.

Built with Cloudflare Workers + Hono + Durable Objects.

**Live:** https://sketch.voxwise.ai

## Features

- **Hand-drawn style** using Rough.js rendering (or clean mode)
- **Infinite canvas** with pan/zoom (5%-1000%)
- **Arrow bindings** — arrows stay connected when shapes move
- **Live updates** via WebSocket
- **AI-agent friendly** — simple HTTP API, no browser required
- **Excalidraw compatible** — export to Excalidraw JSON

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:8787 for API docs, or http://localhost:8787/canvas/demo for a live canvas.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/canvas/:id` | Live viewer (HTML) |
| GET | `/canvas/:id?light=true` | Light mode viewer |
| GET | `/canvas/:id/state` | Canvas state as JSON |
| GET | `/canvas/:id/svg` | Render to SVG |
| GET | `/canvas/:id/png` | Render to PNG |
| POST | `/canvas/:id/draw` | Add/update/delete shapes |
| PUT | `/canvas/:id` | Replace entire canvas |
| DELETE | `/canvas/:id` | Clear canvas |
| GET | `/canvas/:id/export/excalidraw` | Export to Excalidraw |

### SVG/PNG Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `width` | 800 | Output width |
| `height` | 600 | Output height |
| `roughness` | 1 | Hand-drawn roughness (0=smooth) |
| `dark` | false | Dark background |
| `style` | rough | `rough` or `clean` |

## Shape Types

### Basic Shapes

All shapes have common properties:
```typescript
{
  id: string;           // Unique identifier
  type: ShapeType;      // Shape type (see below)
  x: number;            // X position
  y: number;            // Y position
  strokeColor?: string; // Stroke color (default: theme-dependent)
  fillColor?: string;   // Fill color (default: transparent)
  strokeWidth?: number; // Stroke width (default: 2)
  opacity?: number;     // Opacity 0-100 (default: 100)
}
```

### Shape Definitions

```typescript
// Box shapes (all support label)
rectangle: { width, height, label? }
ellipse:   { width, height, label? }
diamond:   { width, height, label? }
cylinder:  { width, height, label? }  // Database symbol
cloud:     { width, height, label? }  // Cloud/external service
hexagon:   { width, height, label? }  // Process node
document:  { width, height, label? }  // Document with curled corner
person:    { width, height, label? }  // Stick figure
callout:   { width, height, label?, pointerX?, pointerY? }

// Line shapes
line:  { points: [{x,y}, ...] }
arrow: { points: [{x,y}, ...], ...arrowProps }

// Text
text: { text, fontSize?, fontFamily? }
```

## Arrow Connectivity

Arrows can be **bound** to shapes — when a shape moves, connected arrows automatically update.

### Binding Object

```typescript
interface Binding {
  shapeId: string;                                    // Target shape ID
  anchor: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
  offsetX?: number;                                   // Fine-tune X
  offsetY?: number;                                   // Fine-tune Y
}
```

### Arrow Properties

```typescript
interface ArrowShape {
  // ... base properties
  points: Point[];              // Path points (at least 2)
  
  // Bindings
  startBinding?: Binding;       // Connect start to a shape
  endBinding?: Binding;         // Connect end to a shape
  
  // Styling
  curved?: boolean;             // Bezier curve (default: false)
  dashed?: boolean;             // Dashed line (default: false)
  arrowHead?: 'arrow' | 'triangle' | 'diamond' | 'circle' | 'none';
  arrowTail?: 'arrow' | 'triangle' | 'diamond' | 'circle' | 'none';
  
  // Labels
  label?: string;               // Text along the arrow
  labelPosition?: number;       // 0=start, 0.5=middle, 1=end
  labelOffset?: { x, y };       // Fine-tune label position
}
```

### Example: Connected Architecture

```bash
curl -X POST https://sketch.voxwise.ai/canvas/demo/draw \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "shapes": [
      { "id": "client", "type": "person", "x": 50, "y": 100, "width": 60, "height": 80, "label": "Client" },
      { "id": "api", "type": "rectangle", "x": 200, "y": 100, "width": 120, "height": 80, "label": "API Server", "fillColor": "#dcfce7" },
      { "id": "db", "type": "cylinder", "x": 400, "y": 100, "width": 100, "height": 80, "label": "Database", "fillColor": "#dbeafe" },
      { 
        "id": "a1", "type": "arrow", "x": 0, "y": 0,
        "points": [{"x": 110, "y": 140}, {"x": 200, "y": 140}],
        "startBinding": { "shapeId": "client", "anchor": "right" },
        "endBinding": { "shapeId": "api", "anchor": "left" },
        "label": "REST"
      },
      { 
        "id": "a2", "type": "arrow", "x": 0, "y": 0,
        "points": [{"x": 320, "y": 140}, {"x": 400, "y": 140}],
        "startBinding": { "shapeId": "api", "anchor": "right" },
        "endBinding": { "shapeId": "db", "anchor": "left" },
        "curved": true,
        "label": "SQL"
      }
    ]
  }'
```

## Draw Commands

```json
{ "action": "add", "shapes": [...] }      // Add new shapes
{ "action": "update", "shapes": [...] }   // Update existing (by id)
{ "action": "delete", "shapeIds": ["id1", "id2"] }
{ "action": "clear" }                     // Remove all shapes
```

## Viewer Controls

| Control | Action |
|---------|--------|
| Scroll | Zoom in/out |
| Drag (empty area) | Pan canvas |
| Click shape | Select |
| Drag shape | Move (updates bound arrows) |
| `⌂` button | Fit content to view |
| `✨` toggle | Switch rough/clean style |
| `📥` button | Export SVG |
| `✏️` toggle | Edit mode on/off |

## Architecture

```
┌─────────────────────────────────────────┐
│  Cloudflare Worker (Hono)               │
│  POST /draw     → update state in DO    │
│  GET /svg       → render via Rough.js   │
│  GET /          → serve viewer page     │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Durable Object (per canvas ID)         │
│  - Holds diagram state (shapes)         │
│  - WebSocket for live updates           │
│  - Persistent storage                   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Browser Viewer                         │
│  - Receives WebSocket updates           │
│  - Infinite canvas with pan/zoom        │
│  - Hand-drawn or clean rendering        │
└─────────────────────────────────────────┘
```

## Multi-User

Each canvas ID (e.g., `/canvas/demo`, `/canvas/my-project`) gets its own Durable Object instance. Multiple users viewing the same canvas see real-time updates.

## Deploy

```bash
bun run deploy
```

Deployed to: `sketchboard.fluxwise.workers.dev` and `sketch.voxwise.ai`

## License

MIT
