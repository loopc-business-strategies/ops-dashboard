// Global test setup for jsdom environment

// ResizeObserver is not available in jsdom — provide a no-op stub
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
