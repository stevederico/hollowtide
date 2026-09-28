import { App } from './app.ts';

declare global {
  interface Window {
    hollowtide?: App;
  }
}

/** Optional analytics, only when both build time variables are set. */
function loadAnalytics(): void {
  const src = import.meta.env.VITE_ANALYTICS_SRC;
  const id = import.meta.env.VITE_ANALYTICS_ID;
  if (!src || !id) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = id;
  document.head.append(script);
}

function showFailure(root: HTMLElement, error: unknown): void {
  console.error('Hollowtide could not start', error);
  const panel = document.createElement('section');
  panel.className = 'overlay';
  panel.innerHTML =
    '<div class="panel"><h2>The Island Is Out Of Reach</h2>' +
    '<p>This browser could not start the 3D view. Try a current browser with WebGL turned on, then reload.</p>' +
    '<div class="actions"><button class="pill primary" type="button">Reload</button></div></div>';
  panel.querySelector('button')?.addEventListener('click', () => window.location.reload());
  root.replaceChildren(panel);
}

function start(): void {
  const canvas = document.getElementById('scene');
  const root = document.getElementById('ui');
  if (!(canvas instanceof HTMLCanvasElement) || !root) throw new Error('Page is missing its canvas');
  try {
    const app = new App(canvas, root);
    const isDebug = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
    if (isDebug) window.hollowtide = app;
    loadAnalytics();
  } catch (error) {
    showFailure(root, error);
  }
}

start();
