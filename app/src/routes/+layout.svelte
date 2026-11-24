<script lang="ts">
	import '../app.css';
	import logo from '#lib/assets/gotv-logo.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const sections = [
		{ path: '/', name: 'Live' },
		{ path: '/kalender', name: 'Kalender' },
		{ path: '/kanaele', name: 'Kanäle' },
		{ path: '/nachspielen', name: 'Nachspielen' }
	] as const;

	function isCurrent(path: string): boolean {
		const here = page.url.pathname.replace(resolve('/'), '/').replace(/\/+$/, '') || '/';
		return here === path;
	}
</script>

<svelte:head>
	<link rel="icon" href={logo} type="image/svg+xml" />
</svelte:head>

<div class="app">
	<header class="top">
		<a class="brand" href={resolve('/')} aria-label="GoTV, zu Live">
			<img src={logo} alt="" width="34" height="34" />
			<span>GoTV</span>
		</a>
		<nav aria-label="Bereiche">
			{#each sections as section (section.path)}
				<a href={resolve(section.path)} aria-current={isCurrent(section.path) ? 'page' : undefined}>
					{section.name}
				</a>
			{/each}
		</nav>
		<a
			class="settings"
			href={resolve('/einstellungen')}
			aria-current={isCurrent('/einstellungen') ? 'page' : undefined}
		>
			Einstellungen
		</a>
	</header>

	<p class="draft">Entwurf der neuen Oberfläche mit Beispieldaten</p>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		min-height: 100dvh;
		padding: 0 max(16px, env(safe-area-inset-right)) 32px max(16px, env(safe-area-inset-left));
		max-width: 1440px;
		margin: 0 auto;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 28px;
		padding: max(14px, env(safe-area-inset-top)) 0 14px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ink);
		text-decoration: none;
		font-weight: 750;
		font-size: 1.3rem;
		letter-spacing: -0.01em;
	}

	.brand img {
		display: block;
		width: 34px;
		height: 34px;
	}

	nav {
		display: flex;
		gap: 4px;
		flex: 1;
		overflow-x: auto;
		scrollbar-width: none;
	}

	nav a,
	.settings {
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		color: var(--ink-soft);
		text-decoration: none;
		white-space: nowrap;
	}

	nav a:hover,
	.settings:hover {
		color: var(--ink);
	}

	nav a[aria-current='page'],
	.settings[aria-current='page'] {
		background: var(--ink);
		color: var(--bg);
	}

	.draft {
		margin: 0 0 16px;
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	/* Oldschool: a classic window menu bar */
	:global([data-design='oldschool']) .top {
		gap: 12px;
		padding: 4px 6px;
		margin: 0 -16px 8px;
		background: var(--surface);
		border-bottom: 2px solid #808080;
	}

	:global([data-design='oldschool']) .brand {
		font-size: 14px;
		font-weight: 700;
	}

	:global([data-design='oldschool']) .brand img {
		width: 22px;
		height: 22px;
	}

	:global([data-design='oldschool']) nav a,
	:global([data-design='oldschool']) .settings {
		padding: 2px 8px;
		color: var(--ink);
	}

	:global([data-design='oldschool']) nav a[aria-current='page'],
	:global([data-design='oldschool']) .settings[aria-current='page'] {
		background: var(--accent);
		color: var(--accent-ink);
	}

	@media (max-width: 720px) {
		.top {
			flex-wrap: wrap;
			gap: 10px 16px;
		}

		nav {
			order: 3;
			flex-basis: 100%;
		}
	}
</style>
