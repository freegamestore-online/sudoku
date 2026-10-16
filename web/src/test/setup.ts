import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const canvasContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  setTransform: vi.fn(),
  globalAlpha: 1,
  fillStyle: "",
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => canvasContext),
});
