/**
 * Browser-global polyfills required by pdfjs-dist (used by pdf-parse).
 * This file MUST be imported first in index.ts — before any other import
 * that transitively loads pdf-parse or pdfjs-dist.
 */

const g = globalThis as Record<string, unknown>;

if (!g["DOMMatrix"]) {
  g["DOMMatrix"] = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(_init?: string | number[]) {}
    multiply() { return this; }
    inverse() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    transformPoint(p: { x?: number; y?: number }) {
      return { x: p.x ?? 0, y: p.y ?? 0, z: 0, w: 1 };
    }
  };
}

if (!g["ImageData"]) {
  g["ImageData"] = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace = "srgb";
    constructor(sw: number, sh: number) {
      this.width = sw;
      this.height = sh;
      this.data = new Uint8ClampedArray(sw * sh * 4);
    }
  };
}

if (!g["Path2D"]) {
  g["Path2D"] = class Path2D {
    moveTo() {}
    lineTo() {}
    arc() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    closePath() {}
    addPath() {}
  };
}

if (!g["OffscreenCanvas"]) {
  g["OffscreenCanvas"] = class OffscreenCanvas {
    width: number;
    height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() { return null; }
  };
}
