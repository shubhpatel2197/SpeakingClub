import type { Betterbugs } from 'http://localhost:9000/index.js';

declare global {
  interface Window {
    bb?: Betterbugs;
  }
}

export {};
