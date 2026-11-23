import '@testing-library/jest-dom/vitest'

// jsdom has no canvas; make getContext quietly return null so components skip drawing.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
}
