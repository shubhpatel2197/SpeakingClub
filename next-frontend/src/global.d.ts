import type { Betterbugs } from '@betterbugs/web-sdk';

declare global {
  interface Window {
    bb?: Betterbugs;
    google?: any;
  }
}

export {};
