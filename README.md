# Sketchboard

Hand-drawn diagram server for AI agents. Rough.js aesthetics via simple HTTP API.

Built with Cloudflare Workers + Hono + Durable Objects + Datastar.

## Features

- **Hand-drawn style** using Rough.js rendering
- **Live updates** via WebSocket + Datastar
- **AI-agent friendly** — simple HTTP API, no browser required
- **Excalidraw compatible** — import/export Excalidraw JSON

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:8787 for API docs, or http://localhost:8787/canvas/demo for a live canvas.

## Usage

### Create a diagram

```bash
curl -X POST http://localhost:8787/canvas/demo/draw \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "shapes": [
      { "id": "box1", "type": "rectangle", "x": 100, "y": 100, "width": 150, "height": 80, "label": "Server", "fillColor": "#dcfce7" }
    ]
  }'
```

### Get SVG

```bash
curl http://localhost:8787/canvas/demo/svg > diagram.svg
```

### Watch live

Open http://localhost:8787/canvas/demo in a browser — updates appear in real-time as shapes are added.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/canvas/:id` | Open live viewer |
| GET | `/canvas/:id/state` | Get canvas state as JSON |
| GET | `/canvas/:id/svg` | Render to SVG |
| POST | `/canvas/:id/draw` | Add/update/delete shapes |
| DELETE | `/canvas/:id` | Clear canvas |
| GET | `/canvas/:id/export/excalidraw` | Export to Excalidraw format |

## Shape Types

```typescript
rectangle: { id, type, x, y, width, height, label?, strokeColor?, fillColor? }
ellipse:   { id, type, x, y, width, height, label?, strokeColor?, fillColor? }
diamond:   { id, type, x, y, width, height, label?, strokeColor?, fillColor? }
line:      { id, type, x, y, points: [{x,y}, ...], strokeColor? }
arrow:     { id, type, x, y, points: [{x,y}, ...], strokeColor? }
text:      { id, type, x, y, text, fontSize?, strokeColor? }
```

## Draw Commands

```json
{ "action": "add", "shapes": [...] }
{ "action": "update", "shapes": [...] }
{ "action": "delete", "shapeIds": ["id1", "id2"] }
{ "action": "clear" }
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Worker (Hono)                          │
│  POST /draw     → update state in DO    │
│  GET /svg       → render via Rough.js   │
│  GET /          → serve viewer page     │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Durable Object                         │
│  - Holds diagram state (shapes)         │
│  - WebSocket for live updates           │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Browser (Datastar)                     │
│  - Receives WebSocket updates           │
│  - Renders SVG                          │
│  - Hand-drawn style, no React           │
└─────────────────────────────────────────┘
```

## Deploy

```bash
bun run deploy
```

## License

MIT
