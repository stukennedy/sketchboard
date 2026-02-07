// Server-side SVG rendering using Rough.js patterns
// Note: We generate SVG path data manually since Rough.js needs DOM

import type { Shape, CanvasState, Point } from '@/types';

interface RenderOptions {
  width?: number;
  height?: number;
  roughness?: number;
  seed?: number;
  darkMode?: boolean;
  style?: 'rough' | 'clean';  // rough = hand-drawn, clean = crisp SVG
}

// Calculate optimal font size for text to fit in a shape
function calcFontSize(text: string, maxWidth: number, maxHeight: number, baseSize: number = 16): number {
  // Handle multi-line text
  const lines = text.split('\n');
  const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
  
  // Rough character width estimate (0.6 * fontSize for Virgil font)
  const charWidthRatio = 0.55;
  const lineHeightRatio = 1.3;
  
  // Calculate max font size that fits width
  const maxFontByWidth = (maxWidth * 0.85) / (longestLine.length * charWidthRatio);
  
  // Calculate max font size that fits height
  const maxFontByHeight = (maxHeight * 0.7) / (lines.length * lineHeightRatio);
  
  // Use the smaller of the two, capped at baseSize
  return Math.min(baseSize, maxFontByWidth, maxFontByHeight, 20);
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
function arrowHead(x: number, y: number, angle: number, size: number = 15, style: string = 'arrow'): string {
  const a1 = angle + Math.PI * 0.8;
  const a2 = angle - Math.PI * 0.8;
  const x1 = x + Math.cos(a1) * size;
  const y1 = y + Math.sin(a1) * size;
  const x2 = x + Math.cos(a2) * size;
  const y2 = y + Math.sin(a2) * size;
  
  switch (style) {
    case 'triangle':
      return `M ${x1} ${y1} L ${x} ${y} L ${x2} ${y2} Z`;
    case 'diamond':
      const dx = x - Math.cos(angle) * size;
      const dy = y - Math.sin(angle) * size;
      return `M ${x} ${y} L ${x1} ${y1} L ${dx} ${dy} L ${x2} ${y2} Z`;
    case 'circle':
      return `M ${x - size/2} ${y} a ${size/2} ${size/2} 0 1 0 ${size} 0 a ${size/2} ${size/2} 0 1 0 ${-size} 0`;
    case 'none':
      return '';
    default: // 'arrow'
      return `M ${x1} ${y1} L ${x} ${y} L ${x2} ${y2}`;
  }
}

// Generate a curved bezier path through points
function curvedPath(points: Point[], rand: () => number, roughness: number = 1): string {
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  if (points.length === 2) {
    // Simple curve with control point
    const p1 = points[0], p2 = points[1];
    const midX = (p1.x + p2.x) / 2 + (rand() - 0.5) * roughness * 5;
    const midY = (p1.y + p2.y) / 2 + (rand() - 0.5) * roughness * 5;
    // Perpendicular offset for curve
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const perpX = -dy / len * 20, perpY = dx / len * 20;
    path += ` Q ${midX + perpX} ${midY + perpY} ${p2.x} ${p2.y}`;
  } else {
    // Use points as curve control points
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const next = points[i + 1];
      const midX = (p.x + next.x) / 2;
      const midY = (p.y + next.y) / 2;
      path += ` Q ${p.x} ${p.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    path += ` Q ${prev.x} ${prev.y} ${last.x} ${last.y}`;
  }
  
  return path;
}

// Generate rough cylinder path
function roughCylinder(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const ellipseH = h * 0.15; // Top/bottom ellipse height
  const bodyH = h - ellipseH * 2;
  const cx = x + w / 2;
  
  // Top ellipse
  const top = roughEllipse(cx, y + ellipseH, w / 2, ellipseH, rand, roughness);
  // Bottom ellipse (visible part)
  const bottom = `M ${x} ${y + h - ellipseH} Q ${x} ${y + h + ellipseH * 0.5} ${cx} ${y + h} Q ${x + w} ${y + h + ellipseH * 0.5} ${x + w} ${y + h - ellipseH}`;
  // Sides
  const leftSide = roughLine(x, y + ellipseH, x, y + h - ellipseH, rand, roughness);
  const rightSide = roughLine(x + w, y + ellipseH, x + w, y + h - ellipseH, rand, roughness);
  
  return `${top} ${leftSide} ${rightSide} ${bottom}`;
}

// Generate rough cloud path
function roughCloud(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const bumps: Point[] = [];
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w / 2, ry = h / 2;
  
  // Generate cloud bumps
  const numBumps = 8;
  for (let i = 0; i < numBumps; i++) {
    const angle = (i / numBumps) * Math.PI * 2;
    const bumpSize = 0.8 + rand() * 0.4;
    bumps.push({
      x: cx + Math.cos(angle) * rx * bumpSize + (rand() - 0.5) * roughness * 3,
      y: cy + Math.sin(angle) * ry * bumpSize + (rand() - 0.5) * roughness * 3
    });
  }
  
  let path = `M ${bumps[0].x} ${bumps[0].y}`;
  for (let i = 0; i < bumps.length; i++) {
    const curr = bumps[i];
    const next = bumps[(i + 1) % bumps.length];
    const cpX = (curr.x + next.x) / 2 + (rand() - 0.5) * w * 0.3;
    const cpY = (curr.y + next.y) / 2 + (rand() - 0.5) * h * 0.3;
    path += ` Q ${cpX} ${cpY} ${next.x} ${next.y}`;
  }
  
  return path;
}

// Generate rough hexagon path
function roughHexagon(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const cx = x + w / 2, cy = y + h / 2;
  const inset = w * 0.25;
  const paths: string[] = [];
  
  paths.push(roughLine(x + inset, y, x + w - inset, y, rand, roughness));
  paths.push(roughLine(x + w - inset, y, x + w, cy, rand, roughness));
  paths.push(roughLine(x + w, cy, x + w - inset, y + h, rand, roughness));
  paths.push(roughLine(x + w - inset, y + h, x + inset, y + h, rand, roughness));
  paths.push(roughLine(x + inset, y + h, x, cy, rand, roughness));
  paths.push(roughLine(x, cy, x + inset, y, rand, roughness));
  
  return paths.join(' ');
}

// Generate rough document path (wavy bottom)
function roughDocument(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const waveH = h * 0.1;
  const paths: string[] = [];
  
  paths.push(roughLine(x, y, x + w, y, rand, roughness));
  paths.push(roughLine(x + w, y, x + w, y + h - waveH, rand, roughness));
  // Wavy bottom
  paths.push(`M ${x + w} ${y + h - waveH} Q ${x + w * 0.75} ${y + h + waveH} ${x + w * 0.5} ${y + h - waveH} Q ${x + w * 0.25} ${y + h - waveH * 3} ${x} ${y + h - waveH}`);
  paths.push(roughLine(x, y + h - waveH, x, y, rand, roughness));
  
  return paths.join(' ');
}

// Generate rough person/stick figure
function roughPerson(x: number, y: number, w: number, h: number, rand: () => number, roughness: number = 1): string {
  const headR = Math.min(w, h) * 0.2;
  const cx = x + w / 2;
  const headY = y + headR;
  const bodyTop = y + headR * 2 + 5;
  const bodyBottom = y + h * 0.65;
  const footY = y + h;
  
  const head = roughEllipse(cx, headY, headR, headR, rand, roughness);
  const body = roughLine(cx, bodyTop, cx, bodyBottom, rand, roughness);
  const leftArm = roughLine(cx, bodyTop + 10, x, bodyTop + 30, rand, roughness);
  const rightArm = roughLine(cx, bodyTop + 10, x + w, bodyTop + 30, rand, roughness);
  const leftLeg = roughLine(cx, bodyBottom, x + w * 0.2, footY, rand, roughness);
  const rightLeg = roughLine(cx, bodyBottom, x + w * 0.8, footY, rand, roughness);
  
  return `${head} ${body} ${leftArm} ${rightArm} ${leftLeg} ${rightLeg}`;
}

// Generate callout/speech bubble
function roughCallout(x: number, y: number, w: number, h: number, px: number, py: number, rand: () => number, roughness: number = 1): string {
  const r = Math.min(w, h) * 0.1; // Corner radius
  const tailW = w * 0.15;
  
  // Pointer position (default bottom-left)
  const pointerX = px || x + w * 0.2;
  const pointerY = py || y + h + 20;
  
  let path = `M ${x + r} ${y}`;
  path += ` L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r}`;
  path += ` L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h}`;
  // Add pointer
  path += ` L ${x + w * 0.35} ${y + h} L ${pointerX} ${pointerY} L ${x + w * 0.15} ${y + h}`;
  path += ` L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r}`;
  path += ` L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y}`;
  
  return path;
}

// Map dark-mode colors to light-mode equivalents
function lightModeColor(color: string): string {
  const darkToLight: Record<string, string> = {
    '#ffffff': '#1e1e1e',
    '#e0e0e0': '#1e1e1e',
    '#94a3b8': '#475569',  // slate
    '#64748b': '#334155',  // slate darker
    '#f87171': '#dc2626',  // red
    '#fb923c': '#ea580c',  // orange
    '#fbbf24': '#d97706',  // amber
    '#facc15': '#ca8a04',  // yellow
    '#34d399': '#059669',  // green
    '#22c55e': '#16a34a',  // green
    '#60a5fa': '#2563eb',  // blue
    '#3b82f6': '#1d4ed8',  // blue
    '#c084fc': '#9333ea',  // purple
    '#a855f7': '#7c3aed',  // purple
    '#f472b6': '#db2777',  // pink
    '#ec4899': '#be185d',  // pink
  };
  const lower = color.toLowerCase();
  return darkToLight[lower] || color;
}

// Render a single shape to SVG elements
function renderShape(shape: Shape, rand: () => number, roughness: number = 1, darkMode: boolean = false, cleanStyle: boolean = false): string {
  const defaultStroke = darkMode ? '#e0e0e0' : '#1e1e1e';
  let stroke = shape.strokeColor || defaultStroke;
  
  // Apply light mode color mapping
  if (!darkMode && shape.strokeColor) {
    stroke = lightModeColor(shape.strokeColor);
  }
  const fill = shape.fillColor || 'none';
  const strokeWidth = shape.strokeWidth || 2;
  const opacity = shape.opacity ?? 1;
  
  const style = `stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"`;
  const styleNoFill = `stroke="${stroke}" fill="none" stroke-width="${strokeWidth}" opacity="${opacity}"`;
  const fillStyle = fill !== 'none' ? `fill="${fill}" opacity="${opacity * 0.3}"` : '';
  
  // Clean style uses crisp SVG primitives
  if (cleanStyle) {
    return renderCleanShape(shape, stroke, fill, strokeWidth, opacity, darkMode);
  }
  
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
        const fontSize = calcFontSize(shape.label, shape.width, shape.height);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
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
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.8);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
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
        const fontSize = calcFontSize(shape.label, shape.width * 0.6, shape.height * 0.6);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
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
      const dashStyle = shape.dashed ? ' stroke-dasharray="8 4"' : '';
      let path = '';
      
      // Offset points by shape position
      const pts = shape.points.map(p => ({ x: shape.x + p.x, y: shape.y + p.y }));
      
      if (shape.curved) {
        path = curvedPath(pts, rand, roughness);
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          path += roughLine(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, rand, roughness) + ' ';
        }
      }
      
      // Arrow head at end
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const headStyle = shape.arrowHead || 'arrow';
      const headPath = arrowHead(last.x, last.y, angle, 12, headStyle);
      
      // Arrow tail at start (if specified)
      let tailPath = '';
      if (shape.arrowTail && shape.arrowTail !== 'none') {
        const first = pts[0];
        const second = pts[1];
        const tailAngle = Math.atan2(first.y - second.y, first.x - second.x);
        tailPath = arrowHead(first.x, first.y, tailAngle, 12, shape.arrowTail);
      }
      
      const headFill = (headStyle === 'triangle' || headStyle === 'diamond') ? stroke : 'none';
      return `<path d="${path}" ${style} fill="none"${dashStyle}/><path d="${headPath}" ${style} fill="${headFill}"/>${tailPath ? `<path d="${tailPath}" ${style} fill="${headFill}"/>` : ''}`;
    }
    
    case 'text': {
      const fontSize = shape.fontSize || 20;
      const fontFamily = shape.fontFamily || 'Virgil, Segoe UI Emoji, sans-serif';
      return `<text x="${shape.x}" y="${shape.y}" font-family="${fontFamily}" font-size="${fontSize}" fill="${stroke}" opacity="${opacity}">${escapeXml(shape.text)}</text>`;
    }
    
    case 'cylinder': {
      const path = roughCylinder(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = '';
      if (fill !== 'none') {
        svg = `<ellipse cx="${shape.x + shape.width/2}" cy="${shape.y + shape.height * 0.15}" rx="${shape.width/2}" ry="${shape.height * 0.15}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>`;
        svg += `<rect x="${shape.x}" y="${shape.y + shape.height * 0.15}" width="${shape.width}" height="${shape.height * 0.7}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>`;
      }
      svg += `<path d="${path}" ${style} fill="none"/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.5);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
      }
      return svg;
    }
    
    case 'cloud': {
      const path = roughCloud(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = '';
      if (fill !== 'none') {
        svg = `<path d="${path}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>`;
      }
      svg += `<path d="${path}" ${style} fill="none"/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const fontSize = calcFontSize(shape.label, shape.width * 0.6, shape.height * 0.5);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
      }
      return svg;
    }
    
    case 'hexagon': {
      const path = roughHexagon(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = '';
      if (fill !== 'none') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const inset = shape.width * 0.25;
        const points = `${shape.x + inset},${shape.y} ${shape.x + shape.width - inset},${shape.y} ${shape.x + shape.width},${cy} ${shape.x + shape.width - inset},${shape.y + shape.height} ${shape.x + inset},${shape.y + shape.height} ${shape.x},${cy}`;
        svg = `<polygon points="${points}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>`;
      }
      svg += `<path d="${path}" ${style} fill="none"/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const fontSize = calcFontSize(shape.label, shape.width * 0.5, shape.height * 0.7);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
      }
      return svg;
    }
    
    case 'document': {
      const path = roughDocument(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = '';
      if (fill !== 'none') {
        svg = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height * 0.9}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>`;
      }
      svg += `<path d="${path}" ${style} fill="none"/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height * 0.4;
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.6);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
      }
      return svg;
    }
    
    case 'person': {
      const path = roughPerson(shape.x, shape.y, shape.width, shape.height, rand, roughness);
      let svg = `<path d="${path}" ${style} fill="none"/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height + 15;
        svg += `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Virgil, Segoe UI Emoji, sans-serif" font-size="14" fill="${stroke}">${escapeXml(shape.label)}</text>`;
      }
      return svg;
    }
    
    case 'callout': {
      const px = shape.pointerX ?? shape.x + shape.width * 0.2;
      const py = shape.pointerY ?? shape.y + shape.height + 20;
      const path = roughCallout(shape.x, shape.y, shape.width, shape.height, px, py, rand, roughness);
      let svg = '';
      if (fill !== 'none') {
        svg = `<path d="${path}" fill="${fill}" opacity="${opacity * 0.3}" stroke="none"/>`;
      }
      svg += `<path d="${path}" ${style} fill="none"/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.7);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, cleanStyle);
      }
      return svg;
    }
    
    default:
      return '';
  }
}

// Render clean/crisp SVG shapes
function renderCleanShape(shape: Shape, stroke: string, fill: string, strokeWidth: number, opacity: number, darkMode: boolean): string {
  const style = `stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"`;
  const radius = 8; // Corner radius for rounded rectangles
  const isClean = true; // We're in clean mode
  
  switch (shape.type) {
    case 'rectangle': {
      let svg = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${radius}" ry="${radius}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const fontSize = calcFontSize(shape.label, shape.width, shape.height);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'ellipse': {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      let svg = `<ellipse cx="${cx}" cy="${cy}" rx="${shape.width/2}" ry="${shape.height/2}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.8);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'diamond': {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const points = `${cx},${shape.y} ${shape.x + shape.width},${cy} ${cx},${shape.y + shape.height} ${shape.x},${cy}`;
      let svg = `<polygon points="${points}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.6, shape.height * 0.6);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'line': {
      if (shape.points.length < 2) return '';
      const pts = shape.points.map(p => `${shape.x + p.x},${shape.y + p.y}`).join(' ');
      return `<polyline points="${pts}" fill="none" ${style}/>`;
    }
    
    case 'arrow': {
      if (shape.points.length < 2) return '';
      const pts = shape.points.map(p => ({ x: shape.x + p.x, y: shape.y + p.y }));
      const dashStyle = shape.dashed ? ' stroke-dasharray="8 4"' : '';
      
      let path = '';
      if (shape.curved && pts.length >= 2) {
        // Smooth bezier curve through all points
        path = `M ${pts[0].x} ${pts[0].y}`;
        if (pts.length === 2) {
          // Simple curve between two points
          const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
          const cx1 = pts[0].x + dx * 0.3, cy1 = pts[0].y + dy * 0.1;
          const cx2 = pts[0].x + dx * 0.7, cy2 = pts[1].y - dy * 0.1;
          path += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pts[1].x} ${pts[1].y}`;
        } else {
          // Catmull-Rom to Bezier conversion for smooth curves through points
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];
            
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
          }
        }
      } else {
        path = 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');
      }
      
      // Arrow head
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const headStyle = shape.arrowHead || 'arrow';
      const headPath = arrowHead(last.x, last.y, angle, 12, headStyle);
      const headFill = (headStyle === 'triangle' || headStyle === 'diamond') ? stroke : 'none';
      
      let svg = `<path d="${path}" fill="none" ${style}${dashStyle}/><path d="${headPath}" stroke="${stroke}" fill="${headFill}" stroke-width="${strokeWidth}"/>`;
      
      // Arrow label - positioned along the path
      if (shape.label) {
        const labelPos = shape.labelPosition ?? 0.5; // Default to middle
        let labelX: number, labelY: number;
        
        if (pts.length === 2) {
          // Linear interpolation for 2-point arrows
          labelX = pts[0].x + (pts[1].x - pts[0].x) * labelPos;
          labelY = pts[0].y + (pts[1].y - pts[0].y) * labelPos;
        } else if (pts.length >= 3 && labelPos === 0.5) {
          // For multi-point arrows, middle label goes at the middle point (anchor)
          const midIdx = Math.floor(pts.length / 2);
          labelX = pts[midIdx].x;
          labelY = pts[midIdx].y;
        } else {
          // Interpolate along the path
          const totalIdx = (pts.length - 1) * labelPos;
          const idx = Math.floor(totalIdx);
          const t = totalIdx - idx;
          const p1 = pts[Math.min(idx, pts.length - 1)];
          const p2 = pts[Math.min(idx + 1, pts.length - 1)];
          labelX = p1.x + (p2.x - p1.x) * t;
          labelY = p1.y + (p2.y - p1.y) * t;
        }
        
        // Apply offset if specified
        if (shape.labelOffset) {
          labelX += shape.labelOffset.x;
          labelY += shape.labelOffset.y;
        }
        
        const fontSize = 12;
        svg += `<text x="${labelX}" y="${labelY - 8}" text-anchor="middle" font-family="Virgil, Inter, sans-serif" font-size="${fontSize}" fill="${stroke}" font-style="italic">${escapeXml(shape.label)}</text>`;
      }
      
      return svg;
    }
    
    case 'text': {
      const fontSize = shape.fontSize || 20;
      return `<text x="${shape.x}" y="${shape.y}" font-family="Inter, -apple-system, sans-serif" font-size="${fontSize}" fill="${stroke}" opacity="${opacity}">${escapeXml(shape.text)}</text>`;
    }
    
    case 'cylinder': {
      const ellipseH = shape.height * 0.12;
      const cx = shape.x + shape.width / 2;
      let svg = `<ellipse cx="${cx}" cy="${shape.y + ellipseH}" rx="${shape.width/2}" ry="${ellipseH}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      svg += `<rect x="${shape.x}" y="${shape.y + ellipseH}" width="${shape.width}" height="${shape.height - ellipseH * 2}" fill="${fill !== 'none' ? fill : 'none'}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
      svg += `<ellipse cx="${cx}" cy="${shape.y + shape.height - ellipseH}" rx="${shape.width/2}" ry="${ellipseH}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.5);
        svg += renderMultilineText(cx, shape.y + shape.height / 2, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'hexagon': {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const inset = shape.width * 0.25;
      const points = `${shape.x + inset},${shape.y} ${shape.x + shape.width - inset},${shape.y} ${shape.x + shape.width},${cy} ${shape.x + shape.width - inset},${shape.y + shape.height} ${shape.x + inset},${shape.y + shape.height} ${shape.x},${cy}`;
      let svg = `<polygon points="${points}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.5, shape.height * 0.7);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'cloud': {
      // Simplified cloud with arcs
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const rx = shape.width / 2, ry = shape.height / 2;
      const path = `M ${shape.x + rx * 0.3} ${shape.y + ry * 1.2} 
        Q ${shape.x} ${cy} ${shape.x + rx * 0.3} ${shape.y + ry * 0.5}
        Q ${shape.x + rx * 0.3} ${shape.y} ${cx} ${shape.y + ry * 0.3}
        Q ${shape.x + shape.width - rx * 0.3} ${shape.y} ${shape.x + shape.width - rx * 0.3} ${shape.y + ry * 0.5}
        Q ${shape.x + shape.width} ${cy} ${shape.x + shape.width - rx * 0.3} ${shape.y + ry * 1.2}
        Q ${shape.x + shape.width - rx * 0.5} ${shape.y + shape.height} ${cx} ${shape.y + ry * 1.5}
        Q ${shape.x + rx * 0.5} ${shape.y + shape.height} ${shape.x + rx * 0.3} ${shape.y + ry * 1.2} Z`;
      let svg = `<path d="${path}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.6, shape.height * 0.5);
        svg += renderMultilineText(cx, cy, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'document': {
      const waveH = shape.height * 0.08;
      const path = `M ${shape.x} ${shape.y} L ${shape.x + shape.width} ${shape.y} L ${shape.x + shape.width} ${shape.y + shape.height - waveH} Q ${shape.x + shape.width * 0.75} ${shape.y + shape.height + waveH} ${shape.x + shape.width * 0.5} ${shape.y + shape.height - waveH} Q ${shape.x + shape.width * 0.25} ${shape.y + shape.height - waveH * 3} ${shape.x} ${shape.y + shape.height - waveH} Z`;
      let svg = `<path d="${path}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.6);
        svg += renderMultilineText(shape.x + shape.width / 2, shape.y + shape.height * 0.4, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    case 'person': {
      const headR = Math.min(shape.width, shape.height) * 0.18;
      const cx = shape.x + shape.width / 2;
      const headY = shape.y + headR + 5;
      let svg = `<circle cx="${cx}" cy="${headY}" r="${headR}" fill="none" ${style}/>`;
      svg += `<line x1="${cx}" y1="${headY + headR}" x2="${cx}" y2="${shape.y + shape.height * 0.6}" ${style}/>`;
      svg += `<line x1="${shape.x + shape.width * 0.15}" y1="${shape.y + shape.height * 0.35}" x2="${shape.x + shape.width * 0.85}" y2="${shape.y + shape.height * 0.35}" ${style}/>`;
      svg += `<line x1="${cx}" y1="${shape.y + shape.height * 0.6}" x2="${shape.x + shape.width * 0.2}" y2="${shape.y + shape.height}" ${style}/>`;
      svg += `<line x1="${cx}" y1="${shape.y + shape.height * 0.6}" x2="${shape.x + shape.width * 0.8}" y2="${shape.y + shape.height}" ${style}/>`;
      if (shape.label) {
        svg += `<text x="${cx}" y="${shape.y + shape.height + 18}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="14" fill="${stroke}">${escapeXml(shape.label)}</text>`;
      }
      return svg;
    }
    
    case 'callout': {
      const px = shape.pointerX ?? shape.x + shape.width * 0.2;
      const py = shape.pointerY ?? shape.y + shape.height + 20;
      const r = 8;
      const path = `M ${shape.x + r} ${shape.y} L ${shape.x + shape.width - r} ${shape.y} Q ${shape.x + shape.width} ${shape.y} ${shape.x + shape.width} ${shape.y + r} L ${shape.x + shape.width} ${shape.y + shape.height - r} Q ${shape.x + shape.width} ${shape.y + shape.height} ${shape.x + shape.width - r} ${shape.y + shape.height} L ${shape.x + shape.width * 0.35} ${shape.y + shape.height} L ${px} ${py} L ${shape.x + shape.width * 0.15} ${shape.y + shape.height} L ${shape.x + r} ${shape.y + shape.height} Q ${shape.x} ${shape.y + shape.height} ${shape.x} ${shape.y + shape.height - r} L ${shape.x} ${shape.y + r} Q ${shape.x} ${shape.y} ${shape.x + r} ${shape.y} Z`;
      let svg = `<path d="${path}" fill="${fill !== 'none' ? fill : 'none'}" ${style}/>`;
      if (shape.label) {
        const fontSize = calcFontSize(shape.label, shape.width * 0.8, shape.height * 0.7);
        svg += renderMultilineText(shape.x + shape.width / 2, shape.y + shape.height / 2, shape.label, fontSize, stroke, isClean);
      }
      return svg;
    }
    
    default:
      return '';
  }
}

// Render multiline text centered
function renderMultilineText(cx: number, cy: number, text: string, fontSize: number, fill: string, cleanStyle: boolean = false): string {
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = cy - totalHeight / 2 + lineHeight / 2;
  
  // Use Inter for clean style, Virgil for rough/hand-drawn style
  const fontFamily = cleanStyle ? 'Inter, -apple-system, sans-serif' : 'Virgil, Segoe UI Emoji, sans-serif';
  
  return lines.map((line, i) => 
    `<text x="${cx}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle" font-family="${fontFamily}" font-size="${fontSize}" fill="${fill}">${escapeXml(line)}</text>`
  ).join('');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Calculate bounds from all shapes with padding
function calculateBounds(shapes: Shape[], padding: number = 200): { minX: number; minY: number; maxX: number; maxY: number } {
  if (shapes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1200, maxY: 800 };
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const shape of shapes) {
    const x = shape.x ?? 0;
    const y = shape.y ?? 0;
    const w = shape.width ?? 100;
    const h = shape.height ?? 50;
    
    // Handle arrow/line points
    if ((shape.type === 'arrow' || shape.type === 'line') && shape.points) {
      for (const p of shape.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    } else {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  }
  
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  };
}

// Render full canvas to SVG
export function renderToSvg(state: CanvasState, options: RenderOptions = {}): string {
  const width = options.width || 800;
  const height = options.height || 600;
  const roughness = options.roughness ?? 1;
  const seed = options.seed || Date.now();
  
  const rand = seededRandom(seed);
  const darkMode = options.darkMode ?? false;
  const bgColor = darkMode ? '#1a1a2e' : (state.backgroundColor || '#ffffff');
  
  // Calculate viewBox from shape bounds (infinite canvas approach)
  const bounds = calculateBounds(state.shapes, 500);
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  
  // Use the larger of viewport size or content bounds
  const vw = Math.max(contentW, width);
  const vh = Math.max(contentH, height);
  const vx = bounds.minX;
  const vy = bounds.minY;
  
  const cleanStyle = options.style === 'clean';
  
  let shapes = '';
  for (const shape of state.shapes) {
    shapes += renderShape(shape, rand, roughness, darkMode, cleanStyle);
  }
  
  // Background rect extends far beyond viewBox for infinite canvas feel
  const bgPad = 10000;
  const bgX = vx - bgPad;
  const bgY = vy - bgPad;
  const bgW = vw + bgPad * 2;
  const bgH = vh + bgPad * 2;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}">
  <rect x="${bgX}" y="${bgY}" width="${bgW}" height="${bgH}" fill="${bgColor}"/>
  ${shapes}
</svg>`;
}

// Export bounds calculation for API use
export { calculateBounds };

// Render to HTML for embedding (no XML declaration)
export function renderToSvgHtml(state: CanvasState, options: RenderOptions = {}): string {
  const svg = renderToSvg(state, options);
  return svg.replace('<?xml version="1.0" encoding="UTF-8"?>\n', '');
}
