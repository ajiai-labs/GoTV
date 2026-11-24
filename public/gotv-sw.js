/* GoTV offline support (service worker) - registered only by the web
 * version (yarn build:pages, see src/util/offline.js).
 *
 * - App files and KataGo (worker, WASM, network) are stored at install and
 *   then served from the cache, so replaying with KataGo works without a
 *   connection.
 * - Page loads and the calendar (events.json) go to the network first and
 *   fall back to the last copy.
 * - Finished OGS games (SGF) are kept once opened; OGS game details and
 *   game lists fall back to the last copy.
 * - Streams, live boards and everything else are never cached.
 *
 * The registration URL carries the build ("?v=<main chunk>"), so each new
 * build installs a new worker and drops the old app cache.
 */
/* eslint-env serviceworker */
"use strict";

var VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
var APP_CACHE = "gotv-app-" + VERSION;
// Games and calendar data survive app updates.
var DATA_CACHE = "gotv-data-v1";
var MAX_DATA_ENTRIES = 300;
var NETWORK_TIMEOUT_MS = 6000;
var SCOPE = self.registration.scope; // ends with "/"

var EXTRA_FILES = [
  "",
  "index.html",
  "manifest.json",
  "tv/events.json",
  "tv/em-finale-2026.sgf",
  "favicon-32x32.png",
  "android-chrome-192x192.png",
  "android-chrome-256x256.png",
  "apple-touch-icon.png",
  "katago/katago-worker.js",
  "katago/tfjs/tfjs-backend-wasm.wasm",
  "katago/tfjs/tfjs-backend-wasm-simd.wasm",
  "katago/tfjs/tfjs-backend-wasm-threaded-simd.wasm",
  "katago/models/katago-small.bin.gz",
];

// Every file of this build, from CRA's asset-manifest.json.
function getAppFiles() {
  return fetch(SCOPE + "asset-manifest.json", { cache: "no-store" })
    .then(function (res) {
      return res.json();
    })
    .then(function (manifest) {
      var files = Object.keys(manifest.files || {})
        .map(function (name) {
          return manifest.files[name];
        })
        .filter(function (path) {
          return (
            !/\.map$|LICENSE|service-worker\.js|precache-manifest/.test(path)
          );
        })
        .map(function (path) {
          return new URL(path, SCOPE).href;
        });
      var all = files.concat(
        EXTRA_FILES.map(function (path) {
          return new URL(path, SCOPE).href;
        })
      );
      // cache.addAll fails on a duplicate (index.html is in both lists).
      return all.filter(function (url, index) {
        return all.indexOf(url) === index;
      });
    });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    getAppFiles()
      .then(function (files) {
        return caches.open(APP_CACHE).then(function (cache) {
          return cache.addAll(files);
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) {
              return name.indexOf("gotv-app-") === 0 && name !== APP_CACHE;
            })
            .map(function (name) {
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function withTimeout(promise) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error("timeout"));
    }, NETWORK_TIMEOUT_MS);
    promise.then(
      function (value) {
        clearTimeout(timer);
        resolve(value);
      },
      function (err) {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Keeps the data cache small: the oldest entries go first.
function trimDataCache(cache) {
  return cache.keys().then(function (keys) {
    var excess = keys.length - MAX_DATA_ENTRIES;
    return Promise.all(
      keys.slice(0, Math.max(0, excess)).map(function (key) {
        return cache.delete(key);
      })
    );
  });
}

function store(cacheName, request, response) {
  if (!response || !response.ok) {
    return response;
  }
  var copy = response.clone();
  caches.open(cacheName).then(function (cache) {
    cache.put(request, copy).then(function () {
      if (cacheName === DATA_CACHE) {
        trimDataCache(cache);
      }
    });
  });
  return response;
}

// noTimeout: only a real network error falls back to the cache - for OGS
// game data, which a live board polls; a slow answer must not be replaced
// by an old position.
function networkFirst(request, cacheName, fallbackUrl, noTimeout) {
  return (noTimeout ? fetch(request) : withTimeout(fetch(request)))
    .then(function (response) {
      return store(cacheName, request, response);
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) {
          return cached;
        }
        if (fallbackUrl) {
          return caches.match(fallbackUrl);
        }
        return Response.error();
      });
    });
}

function cacheFirst(request, cacheName) {
  return caches.match(request).then(function (cached) {
    if (cached) {
      return cached;
    }
    return fetch(request).then(function (response) {
      return store(cacheName, request, response);
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") {
    return;
  }
  var url = new URL(request.url);

  // The new interface (preview under /neu/, docs/umbau-svelte.md) is its own
  // app - this worker must not answer for it with the old start page.
  if (url.href.indexOf(SCOPE + "neu/") === 0) {
    return;
  }

  if (request.mode === "navigate" && url.href.indexOf(SCOPE) === 0) {
    event.respondWith(networkFirst(request, APP_CACHE, SCOPE + "index.html"));
    return;
  }
  if (url.href.indexOf(SCOPE) === 0) {
    if (/\/tv\/events\.json$/.test(url.pathname)) {
      event.respondWith(networkFirst(request, DATA_CACHE));
    } else if (url.pathname.indexOf("/static/") !== -1 || url.pathname.indexOf("/katago/") !== -1) {
      event.respondWith(cacheFirst(request, APP_CACHE));
    } else {
      event.respondWith(networkFirst(request, APP_CACHE));
    }
    return;
  }
  if (url.hostname === "raw.githubusercontent.com" && /\/tv\/events\.json$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }
  if (url.hostname === "online-go.com") {
    // A finished game's SGF never changes; a running game's SGF is refused
    // by OGS (403) and therefore never stored.
    if (/^\/api\/v1\/games\/\d+\/sgf\/?$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, DATA_CACHE));
      return;
    }
    if (/^\/api\/v1\/(games\/\d+\/?|players\/)/.test(url.pathname)) {
      event.respondWith(networkFirst(request, DATA_CACHE, null, true));
      return;
    }
  }
  // Streams, live boards, KGS: straight to the network.
});
