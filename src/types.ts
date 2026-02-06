// Shape types for hand-drawn diagrams

export type ShapeType = 
  | 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'text'
  // New shapes
  | 'cylinder' | 'cloud' | 'hexagon' | 'document' | 'person' | 'callout';

export interface Point {
  x: number;
  y: number;
}

export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';

export interface Binding {
  shapeId: string;
  anchor: AnchorPosition;
  // Offset from anchor point (for fine-tuning)
  offsetX?: number;
  offsetY?: number;
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
  label?: string;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  width: number;
  height: number;
  label?: string;
}

export interface DiamondShape extends BaseShape {
  type: 'diamond';
  width: number;
  height: number;
  label?: string;
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: Point[];
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  points: Point[];
  startBinding?: Binding | string; // Binding object or shape id (legacy)
  endBinding?: Binding | string;   // Binding object or shape id (legacy)
  curved?: boolean;      // use bezier curves
  dashed?: boolean;      // dashed line
  arrowHead?: 'arrow' | 'triangle' | 'diamond' | 'circle' | 'none';
  arrowTail?: 'arrow' | 'triangle' | 'diamond' | 'circle' | 'none';
  // Arrow label - positioned along the path
  label?: string;
  labelPosition?: number; // 0 = start, 0.5 = middle (default), 1 = end
  labelOffset?: { x: number; y: number }; // Fine-tune label position
}

export interface CylinderShape extends BaseShape {
  type: 'cylinder';
  width: number;
  height: number;
  label?: string;
}

export interface CloudShape extends BaseShape {
  type: 'cloud';
  width: number;
  height: number;
  label?: string;
}

export interface HexagonShape extends BaseShape {
  type: 'hexagon';
  width: number;
  height: number;
  label?: string;
}

export interface DocumentShape extends BaseShape {
  type: 'document';
  width: number;
  height: number;
  label?: string;
}

export interface PersonShape extends BaseShape {
  type: 'person';
  width: number;
  height: number;
  label?: string;
}

export interface CalloutShape extends BaseShape {
  type: 'callout';
  width: number;
  height: number;
  label?: string;
  pointerX?: number;  // relative to shape
  pointerY?: number;
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
}

export type Shape = 
  | RectangleShape | EllipseShape | DiamondShape | LineShape | ArrowShape | TextShape
  | CylinderShape | CloudShape | HexagonShape | DocumentShape | PersonShape | CalloutShape;

export interface CanvasState {
  id: string;
  shapes: Shape[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  backgroundColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DrawCommand {
  action: 'add' | 'update' | 'delete' | 'clear';
  shapes?: Shape[];
  shapeIds?: string[];
}

// Excalidraw-compatible export format
export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[][];
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
}

export interface ExcalidrawFile {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: string;
  };
}
