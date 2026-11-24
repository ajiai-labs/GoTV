<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import '../app.css';
	import logo from '#lib/assets/gotv-logo.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { app, currentPath } from '#lib/app.svelte.ts';
	import { config } from '#lib/config.ts';
	import { registerServiceWorker } from '#lib/util/serviceWorker.ts';
	import UnseenBadge from '#lib/ui/UnseenBadge.svelte';
	import UserName from '#lib/ui/UserName.svelte';
	import OfflineAlert from '#lib/ui/OfflineAlert.svelte';
	import UserDetailsModal from '#lib/ui/user/UserDetailsModal.svelte';
	import FeedbackModal from '#lib/ui/FeedbackModal.svelte';
	import UnderConstructionModal from '#lib/ui/UnderConstructionModal.svelte';
	import ReminderWatcher from '#lib/ui/tv/ReminderWatcher.svelte';
	import FollowWatcher from '#lib/ui/user/FollowWatcher.svelte';
	import FavoriteRoomsWatcher from '#lib/ui/chat/FavoriteRoomsWatcher.svelte';
	import HomeScreenHint from '#lib/ui/HomeScreenHint.svelte';
	import { effectiveNavOrder, navOrder } from '#lib/ui/navOrder.svelte.ts';
	import type { NavOrder } from '#lib/ui/navOrder.svelte.ts';
	import { fetchTvEvents, hasLiveBroadcast } from '#lib/model/tv.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tvSections = [
		{ path: '/', name: 'app.nav.live' },
		{ path: '/kalender', name: 'app.nav.calendar' },
		{ path: '/kanaele', name: 'app.nav.channels' },
		{ path: '/nachspielen', name: 'app.nav.replay' }
	] as const;

	const kgsSections = [
		{ path: '/beobachten', name: 'app.nav.watch', badge: null },
		{ path: '/spielen', name: 'app.nav.play', badge: 'play' },
		{ path: '/chat', name: 'app.nav.chat', badge: 'chat' },
		{ path: '/suche', name: 'app.nav.search', badge: null }
	] as const;

	// "Live" lights up while a broadcast runs (same rule as the Live page), so
	// it is noticed also when the KGS order puts it further back.
	let tvEvents: Array<TvEvent> = $state([]);
	let now = $state(Date.now());
	let liveNow = $derived(
		hasLiveBroadcast(app.state.activeGames, tvEvents, app.state.roomsById, new Date(now))
	);
	// The KGS order switches to the GoTV order while a broadcast is on. Not
	// while the pointer is on the menu - an item must not move under a click.
	let pointerOnNav = $state(false);
	let shownOrder: NavOrder = $state(navOrder.current);
	$effect(() => {
		const wanted = effectiveNavOrder(navOrder.current, liveNow);
		if (!pointerOnNav) shownOrder = wanted;
	});

	function refreshLive() {
		now = Date.now();
		fetchTvEvents()
			.then((events) => (tvEvents = events))
			.catch(() => {
				// no calendar (offline): no light
			});
	}
	onMount(() => {
		refreshLive();
		const timer = setInterval(refreshLive, 60000);
		return () => clearInterval(timer);
	});

	onMount(() => {
		app.start();
		registerServiceWorker();
	});

	// The old app's "nav" follows the page (links, back/forward).
	$effect(() => {
		void page.url.pathname;
		app.syncNav(currentPath());
	});

	// Clicking "Beobachten" again while a game is open goes back to the list,
	// as the old app's second click on "Watch" did (AppActions.onChangeNav).
	function onReselect(path: string) {
		if (path === '/beobachten' && isCurrent(path) && app.started) {
			app.actions.onChangeNav('watch', { push: false });
		}
	}

	function isCurrent(path: string): boolean {
		void page.url.pathname;
		const here = currentPath();
		return path === '/' ? here === '/' : here === path || here.startsWith(path + '/');
	}

	let appState = $derived(app.state);

	// Unseen chat messages: direct messages count "major", rooms "minor".
	let chatBadge = $derived.by(() => {
		let major = 0;
		let minor = 0;
		for (const [id, convo] of Object.entries(appState.conversationsById)) {
			const chan = appState.channelMembership[id];
			if (!chan || (chan.type !== 'room' && chan.type !== 'conversation')) continue;
			if (!convo.unseenCount) continue;
			if (convo.user) major += convo.unseenCount;
			else minor += convo.unseenCount;
		}
		return { major, minor };
	});

	// The challenge being negotiated: received proposals and its chat.
	let playBadge = $derived.by(() => {
		const challenge = appState.playChallengeId
			? appState.gamesById[appState.playChallengeId]
			: null;
		if (!challenge) return { major: 0, minor: 0 };
		return {
			major: challenge.receivedProposals ? challenge.receivedProposals.length : 0,
			minor: appState.conversationsById[challenge.id]?.unseenCount ?? 0
		};
	});

	// Chat, Beobachten and Spielen fill the window height (iPad, no scrolling):
	// no footer there.
	const FULL_HEIGHT_PAGES = ['/chat', '/beobachten', '/spielen'];
	let showFooter = $derived.by(() => {
		void page.url.pathname;
		return !FULL_HEIGHT_PAGES.some((path) => isCurrent(path));
	});

	let offline = $derived(
		!!appState.currentUser &&
			(appState.clientState.status === 'loggedOut' || appState.clientState.network !== 'online')
	);
</script>

<svelte:head>
	<link rel="icon" href={logo} type="image/svg+xml" />
</svelte:head>

{#snippet tvNav()}
	{#each tvSections as section (section.path)}
		{@const live = section.path === '/' && liveNow}
		<a
			href={resolve(section.path)}
			aria-current={isCurrent(section.path) ? 'page' : undefined}
			class:live
			title={live ? t('app.nav.liveNow') : undefined}
		>
			{#if live}<span class="live-dot" aria-hidden="true"></span>{/if}
			{t(section.name)}
			{#if live}<span class="visually-hidden">– {t('app.nav.liveNow')}</span>{/if}
		</a>
	{/each}
{/snippet}

{#snippet kgsNav()}
	{#each kgsSections as section (section.path)}
		{@const badge =
			section.badge === 'chat' ? chatBadge : section.badge === 'play' ? playBadge : null}
		<a
			href={resolve(section.path)}
			aria-current={isCurrent(section.path) ? 'page' : undefined}
			onclick={() => onReselect(section.path)}
		>
			{t(section.name)}
			{#if badge && !isCurrent(section.path)}
				<UnseenBadge major={badge.major} minor={badge.minor} />
			{/if}
		</a>
	{/each}
{/snippet}

<div class="app">
	<header class="top">
		<a
			class="brand"
			class:on-air={liveNow}
			href={resolve('/')}
			aria-label={liveNow
				? `${t('app.layout.home')} – ${t('app.nav.liveNow')}`
				: t('app.layout.home')}
			title={liveNow ? t('app.nav.liveNow') : undefined}
		>
			<img src={logo} alt="" width="34" height="34" />
			<span>GoTV</span>
		</a>
		<nav
			aria-label={t('app.layout.areas')}
			onpointerenter={() => (pointerOnNav = true)}
			onpointerleave={() => (pointerOnNav = false)}
		>
			{#if shownOrder === 'kgs'}
				{@render kgsNav()}
				<span class="divider" aria-hidden="true"></span>
				{@render tvNav()}
			{:else}
				{@render tvNav()}
				<span class="divider" aria-hidden="true"></span>
				{@render kgsNav()}
			{/if}
		</nav>
		<div class="account">
			{#if appState.currentUser}
				<a
					class="who"
					href={resolve('/konto')}
					aria-current={isCurrent('/konto') ? 'page' : undefined}
				>
					<UserName user={appState.currentUser} />
				</a>
			{:else if !config.guestOnly}
				<a class="who" href={resolve('/beobachten')}>{t('app.layout.login')}</a>
			{/if}
			<a
				class="settings"
				href={resolve('/einstellungen')}
				aria-current={isCurrent('/einstellungen') ? 'page' : undefined}
				aria-label={t('app.layout.settings')}
				title={t('app.layout.settings')}
			>
				⚙
			</a>
		</div>
	</header>

	{#if offline}
		<OfflineAlert />
	{/if}

	<!-- Web version on iPad/iPhone Safari: how to add GoTV to the home screen -->
	<HomeScreenHint />

	<main>
		{@render children()}
	</main>

	{#if showFooter}
		<footer class="foot">
			<a href="https://github.com/ajiai-labs/GoTV" target="_blank" rel="noopener noreferrer">
				{t('app.layout.github')}
			</a>
			<span class="muted">{t('app.layout.openProject')}</span>
		</footer>
	{/if}

	{#if appState.userDetailsRequest}
		<UserDetailsModal />
	{/if}
	<!-- "Mein GoTV": notifications 10 min before a starred event, app-wide -->
	<ReminderWatcher />
	<!-- Followed KGS players: a notification when one starts a game -->
	{#if !config.guestOnly}
		<FollowWatcher />
		<FavoriteRoomsWatcher />
	{/if}

	{#if appState.showUnderConstruction}
		<UnderConstructionModal onClose={() => app.actions.onHideUnderConstruction()} />
	{/if}
	{#if appState.showFeedbackModal}
		<FeedbackModal
			currentUser={appState.currentUser}
			onClose={() => app.actions.onHideFeedbackModal()}
		/>
	{/if}
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
		gap: 20px;
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

	/* GoTV itself lights up while a broadcast runs, together with "Live". */
	.brand.on-air img {
		animation: brand-on-air 1.6s ease-in-out infinite alternate;
	}

	.brand.on-air span {
		color: var(--live);
	}

	@media (prefers-reduced-motion: reduce) {
		.brand.on-air img {
			animation: none;
			filter: drop-shadow(0 0 5px var(--live));
		}
	}

	@keyframes brand-on-air {
		from {
			filter: drop-shadow(0 0 1px color-mix(in srgb, var(--live) 50%, transparent));
		}
		to {
			filter: drop-shadow(0 0 7px var(--live));
		}
	}

	nav {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}

	/* "Live" while a broadcast runs: an on-air light. */
	.live {
		color: var(--ink);
		font-weight: 650;
	}

	.live-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--live);
		box-shadow: 0 0 0 0 var(--live);
		animation: on-air 1.6s ease-out infinite;
	}

	@keyframes on-air {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--live) 70%, transparent);
		}
		100% {
			box-shadow: 0 0 0 8px transparent;
		}
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.divider {
		width: 1px;
		height: 20px;
		margin: 0 8px;
		background: var(--rule);
		flex: none;
	}

	nav a,
	.account a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: var(--radius-pill);
		color: var(--ink-soft);
		text-decoration: none;
		white-space: nowrap;
	}

	nav a:hover,
	.account a:hover {
		color: var(--ink);
	}

	nav a[aria-current='page'],
	.account a[aria-current='page'] {
		background: var(--ink);
		color: var(--bg);
	}

	.account {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: none;
	}

	.settings {
		font-size: 1.15rem;
	}

	main {
		padding-top: 4px;
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 40px;
		padding-top: 12px;
		border-top: 1px solid var(--rule);
		font-size: 0.85em;
	}

	/* Oldschool: a classic window menu bar */
	:global([data-design='oldschool']) .top {
		gap: 10px;
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
	:global([data-design='oldschool']) .account a {
		padding: 2px 8px;
		color: var(--ink);
		border-radius: 0;
	}

	:global([data-design='oldschool']) nav a[aria-current='page'],
	:global([data-design='oldschool']) .account a[aria-current='page'] {
		background: var(--accent);
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .divider {
		background: #808080;
	}

	@media (max-width: 760px) {
		.top {
			flex-wrap: wrap;
			gap: 8px 12px;
		}

		.account {
			margin-left: auto;
		}

		nav {
			order: 3;
			flex-basis: 100%;
		}
	}
</style>
