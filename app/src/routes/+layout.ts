// GoTV runs entirely in the browser (GitHub Pages, desktop server, iPad):
// no server-side rendering; the app boots in the browser.
export const ssr = false;
// Each page as its own file, so reloading e.g. /neu/kalender on GitHub Pages works.
export const prerender = true;
