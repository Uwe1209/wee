import { App } from './app.js';

try {
  const app = new App();
  window.__app = app.api;
  app.start().catch((error) => {
    console.error(error);
    document.documentElement.classList.add('no-webgl');
  });
} catch (error) {
  // No WebGL2: the page still reads top to bottom as plain HTML.
  console.error(error);
  document.documentElement.classList.add('no-webgl');
  window.__app = { ready: true, failed: () => ['all'] };
}
