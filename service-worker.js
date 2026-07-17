// Minimal service worker — required for Chrome/Android to treat this as an
// installable app (shows the "Install app" prompt with proper icon and
// standalone window). This does NOT cache anything or work offline;
// it just satisfies the installability check.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A no-op fetch handler is required for Chrome to consider the app installable.
self.addEventListener('fetch', () => {});
