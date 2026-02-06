// Server-side SVG rendering using Rough.js patterns
// Note: We generate SVG path data manually since Rough.js needs DOM

import type { Shape, CanvasState, Point } from '@/types';

interface RenderOptions {
  width?: number;
  height?: number;
  roughness?: number;
  seed?: number;
}

// Simple seeded random for consistent hand-drawn effect
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff);
  };
}

// Add hand-drawn jitter to a point
function jitter(x: number, y: number, amount: number, rand: () => number): Point {
  return {
    x: x + (rand() - 0.5) * amount,
    y: y + (rand() - 0.5) * amount
  };
}

// Generate a rough line path between two points
function roughLine(x1: number, y1: number, x2: number, y2: number, rand: () => number, roughness: number = 1): string {
  const jitterAmount = roughness * 2;
  const p1 = jitter(x1, y1, jitterAmount, rand);
  const p2 = jitter(x2, y2, jitterAmount, rand);
  
  // Add slight curve for hand-drawn effect
  const midX = (p1.x + p2.x) / 2 + (rand() - 0.5) * roughness * 3;
  const midY = (p1.y + p2.y) / 2 + (rand() - 0.5) * roughness * 3;
  
  return `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;
}

// Generate a rough rectangle path
function roughRect(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const paths: string[] = [];
  // Draw each side with slight overlap for hand-drawn effect
  paths.push(roughLine(x, y, x + w, y, rand, roughness));
  paths.push(roughLine(x + w, y, x + w, y + h, rand, roughness));
  paths.push(roughLine(x + w, y + h, x, y + h, rand, roughness));
  paths.push(roughLine(x, y + h, x, y, rand, roughness));
  return paths.join(' ');
}

// Generate a rough ellipse path
function roughEllipse(cx: number, cy: number, rx: number, ry: number, rand: () => number, roughness: number = 1): string {
  const points: Point[] = [];
  const steps = 24;
  
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const jitterAmount = roughness * 2;
    points.push({
      x: cx + Math.cos(angle) * rx + (rand() - 0.5) * jitterAmount,
      y: cy + Math.sin(angle) * ry + (rand() - 0.5) * jitterAmount
    });
  }
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2 + (rand() - 0.5) * roughness;
    const cpY = (prev.y + curr.y) / 2 + (rand() - 0.5) * roughness;
    path += ` Q ${cpX} ${cpY} ${curr.x} ${curr.y}`;
  }
  path += ' Z';
  
  return path;
}

// Generate a rough diamond path
function roughDiamond(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const paths: string[] = [];
  paths.push(roughLine(cx, y, x + w, cy, rand, roughness));
  paths.push(roughLine(x + w, cy, cx, y + h, rand, roughness));
  paths.push(roughLine(cx, y + h, x, cy, rand, roughness));
  paths.push(roughLine(x, cy, cx, y, rand, roughness));
  return paths.join(' ');
}

// Generate an arrow head
function arrowHead(x: number, y: number, angle: number, size: number = 15): string {
  const a1 = angle + Math.PI * 0.8;
  const a2 = angle - Math.PI * 0.8;
  const x1 = x + Math.cos(a1) * size;
  const y1 = y + Math.sin(a1) * size;
  const x2 = x + Math.cos(a2) * size;
  const y2 = y + Math.sin(a2) * size;
  return `M ${x1} ${y1} L ${x} ${y} L ${x2} ${y2}`;
}

// Render a single shape to SVG elements
function renderShape(shape: Shape, rand: () => number, roughness: number = 1): string {
  const stroke = shape.strokeColor || '#1e1e1e';
  const fill = shape.fillColor || 'none';
  const strokeWidth = shape.strokeWidth || 2;
  const opacity = shape.opacity ?? 1;
  
  const style = `stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}" opacity="${opacity}"`;
  
  switch (shape.type) {
    case 'rectangle': {
      const path = roughRect(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = `<path d="${path}" ${style} fill="none"/>`;
      if (fill !== 'none') {
        svg = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>` + svg;
      }
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="Virgil, Segoe UI Emoji, sans-serif" font-size="16" fill="${stroke}">${escapeXml(shape.label)}</text>`;
      }
      return svg;
    }
    
    case 'ellipse': {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const path = roughEllipse(cx, cy, shape.width / 2, shape.height / 2, rand, roughness);
      let svg = `<path d="${path}" ${style} fill="none"/>`;
      if (fill !== 'none') {
        svg = `<ellipse cx="${cx}" cy="${cy}" rx="${shape.width / 2}" ry="${shape.height / 2}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>` + svg;
      }
      if (shape.label) {
        svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="Virgil, Segoe UI Emoji, sans-serif" font-size="16" fill="${stroke}">${escapeXml(shape.label)}</text>`;
      }
      return svg;
    }
    
    case 'diamond': {
      const path = roughDiamond(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = `<path d="${path}" ${style} fill="none"/>`;
      if (fill !== 'none') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const points = `${cx},${shape.y} ${shape.x + shape.width},${cy} ${cx},${shape.y + shape.height} ${shape.x},${cy}`;
        svg = `<polygon points="${points}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>` + svg;
      }
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="Virgil, Segoe UI Emoji, sans-serif" font-size="16" fill="${stroke}">${escapeXml(shape.label)}</text>`;
      }
      return svg;
    }
    
    case 'line': {
      if (shape.points.length < 2) return '';
      let path = '';
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[i + 1];
        path += roughLine(shape.x + p1.x, shape.y + p1.y, shape.x + p2.x, shape.y + p2.y, rand, roughness) + ' ';
      }
      return `<path d="${path}" ${style} fill="none"/>`;
    }
    
    case 'arrow': {
      if (shape.points.length < 2) return '';
      let path = '';
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[i + 1];
        path += roughLine(shape.x + p1.x, shape.y + p1.y, shape.x + p2.x, shape.y + p2.y, rand, roughness) + ' ';
      }
      // Add arrow head
      const last = shape.points[shape.points.length - 1];
      const prev = shape.points[shape.points.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const headPath = arrowHead(shape.x + last.x, shape.y + last.y, angle);
      return `<path d="${path}" ${style} fill="none"/><path d="${headPath}" ${style} fill="none"/>`;
    }
    
    case 'text': {
      const fontSize = shape.fontSize || 20;
      const fontFamily = shape.fontFamily || 'Virgil, Segoe UI Emoji, sans-serif';
      return `<text x="${shape.x}" y="${shape.y}" font-family="${fontFamily}" font-size="${fontSize}" fill="${stroke}" opacity="${opacity}">${escapeXml(shape.text)}</text>`;
    }
    
    default:
      return '';
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Render full canvas to SVG
export function renderToSvg(state: CanvasState, options: RenderOptions = {}): string {
  const width = options.width || 800;
  const height = options.height || 600;
  const roughness = options.roughness ?? 1;
  const seed = options.seed || Date.now();
  
  const rand = seededRandom(seed);
  const bgColor = state.backgroundColor || '#ffffff';
  
  // Calculate viewBox based on viewport
  const vx = state.viewport.x;
  const vy = state.viewport.y;
  const vw = width / state.viewport.zoom;
  const vh = height / state.viewport.zoom;
  
  let shapes = '';
  for (const shape of state.shapes) {
    shapes += renderShape(shape, rand, roughness);
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}">
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bgColor}"/>
  ${shapes}
</svg>`;
}

// Render to HTML for embedding (no XML declaration)
export function renderToSvgHtml(state: CanvasState, options: RenderOptions = {}): string {
  const svg = renderToSvg(state, options);
  return svg.replace('<?xml version="1.0" encoding="UTF-8"?>\n', '');
}
