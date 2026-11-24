/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// GoTV offline support for the web version (GitHub Pages, VITE_GUEST_ONLY),
// the new app's counterpart of public/gotv-sw.js with the same strategies:
//
// - App files, pages and KataGo (worker, WASM, network) are stored at
//   install and served from the cache, so replaying with KataGo works
//   without a connection.
// - Page loads and the calendar (events.json) go to the network first and
//   fall back to the last copy after 6 s or a network error.
// - Finished OGS games (SGF) are kept once opened; OGS game details and
//   player game lists go to the network first without a time limit (a live
//   board polls them) and fall back to the last copy only on an error.
// - Streams, live boards, KGS and everything else are never cached.
//
// SvelteKit's `version` changes with every build, so a new build installs
// a new worker and drops the old app cache.
import { self as sw } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const APP_CACHE = `gotv-app-${version}`;
// Games and calendar data survive app updates.
const DATA_CACHE = 'gotv-data-v1';
const MAX_DATA_ENTRIES = 300;
const NETWORK_TIMEOUT_MS = 6000;
const SCOPE = sw.registration.scope; // ends with "/"

// Static files worth having offline (others, like robots.txt, are not).
const OFFLINE_FILES = /\/(tv\/(events\.json|em-finale-2026\.sgf|demo\.sgf)|katago\/.+)$/;

// Manifest paths are relative to the base path, like the scope.
function appFiles(): Array<string> {
	const paths = [
		...immutable.map((file) => file.path),
		...prerendered.map((page) => page.path),
		...assets.map((file) => file.path).filter((path) => OFFLINE_FILES.test('/' + path)),
		''
	];
	const all = paths.map((path) => new URL(path.replace(/^\/+/, ''), SCOPE).href);
	// cache.addAll fails on a duplicate.
	return [...new Set(all)];
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(APP_CACHE)
			.then((cache) => cache.addAll(appFiles()))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((names) =>
				Promise.all(
					names
						.filter((name) => name.startsWith('gotv-app-') && name !== APP_CACHE)
						.map((name) => caches.delete(name))
				)
			)
			.then(() => sw.clients.claim())
	);
});

function withTimeout<T>(promise: Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err: unknown) => {
				clearTimeout(timer);
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		);
	});
}

// Keeps the data cache small: the oldest entries go first.
async function trimDataCache(cache: Cache) {
	const keys = await cache.keys();
	const excess = keys.length - MAX_DATA_ENTRIES;
	await Promise.all(keys.slice(0, Math.max(0, excess)).map((key) => cache.delete(key)));
}

function store(cacheName: string, request: Request, response: Response): Response {
	if (!response.ok) return response;
	const copy = response.clone();
	void caches.open(cacheName).then(async (cache) => {
		await cache.put(request, copy);
		if (cacheName === DATA_CACHE) await trimDataCache(cache);
	});
	return response;
}

// noTimeout: only a real network error falls back to the cache.
async function networkFirst(
	request: Request,
	cacheName: string,
	fallbackUrl: string | null = null,
	noTimeout = false
): Promise<Response> {
	try {
		const response = await (noTimeout ? fetch(request) : withTimeout(fetch(request)));
		return store(cacheName, request, response);
	} catch {
		const cached = await caches.match(request);
		if (cached) return cached;
		if (fallbackUrl) {
			const fallback = await caches.match(fallbackUrl);
			if (fallback) return fallback;
		}
		return Response.error();
	}
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
	const cached = await caches.match(request);
	if (cached) return cached;
	return store(cacheName, request, await fetch(request));
}

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	if (url.href.startsWith(SCOPE)) {
		if (request.mode === 'navigate') {
			// Unknown pages fall back to the start page (the app routes itself).
			event.respondWith(networkFirst(request, APP_CACHE, SCOPE));
		} else if (/\/tv\/events\.json$/.test(url.pathname)) {
			event.respondWith(networkFirst(request, DATA_CACHE));
		} else if (url.pathname.includes('/_app/') || url.pathname.includes('/katago/')) {
			event.respondWith(cacheFirst(request, APP_CACHE));
		} else if (!url.pathname.includes('/json/')) {
			event.respondWith(networkFirst(request, APP_CACHE));
		}
		return;
	}
	if (url.hostname === 'raw.githubusercontent.com' && /\/tv\/events\.json$/.test(url.pathname)) {
		event.respondWith(networkFirst(request, DATA_CACHE));
		return;
	}
	if (url.hostname === 'online-go.com') {
		// A finished game's SGF never changes; a running game's SGF is refused
		// by OGS (403) and therefore never stored.
		if (/^\/api\/v1\/games\/\d+\/sgf\/?$/.test(url.pathname)) {
			event.respondWith(cacheFirst(request, DATA_CACHE));
			return;
		}
		if (/^\/api\/v1\/(games\/\d+\/?|players\/)/.test(url.pathname)) {
			event.respondWith(networkFirst(request, DATA_CACHE, null, true));
		}
	}
	// Streams, live boards, KGS: straight to the network.
});
