// Shape types for hand-drawn diagrams

export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'diamond';

export interface Point {
  x: number;
  y: number;
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
  startBinding?: string; // shape id
  endBinding?: string;   // shape id
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
}

export type Shape = RectangleShape | EllipseShape | DiamondShape | LineShape | ArrowShape | TextShape;

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
