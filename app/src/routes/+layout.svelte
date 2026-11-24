<script lang="ts">
	import '../app.css';
	import logo from '#lib/assets/gotv-logo.svg';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { app, currentPath } from '#lib/app.svelte.ts';
	import { config } from '#lib/config.ts';
	import UnseenBadge from '#lib/ui/UnseenBadge.svelte';
	import UserName from '#lib/ui/UserName.svelte';
	import OfflineAlert from '#lib/ui/OfflineAlert.svelte';
	import UserDetailsModal from '#lib/ui/user/UserDetailsModal.svelte';
	import FeedbackModal from '#lib/ui/FeedbackModal.svelte';
	import UnderConstructionModal from '#lib/ui/UnderConstructionModal.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tvSections = [
		{ path: '/', name: 'Live' },
		{ path: '/kalender', name: 'Kalender' },
		{ path: '/kanaele', name: 'Kanäle' },
		{ path: '/nachspielen', name: 'Nachspielen' }
	] as const;

	const kgsSections = [
		{ path: '/beobachten', name: 'Beobachten', badge: null },
		{ path: '/spielen', name: 'Spielen', badge: 'play' },
		{ path: '/chat', name: 'Chat', badge: 'chat' },
		{ path: '/suche', name: 'Suche', badge: null }
	] as const;

	onMount(() => app.start());

	// The old app's "nav" follows the page (links, back/forward).
	$effect(() => {
		void page.url.pathname;
		app.syncNav(currentPath());
	});

	function isCurrent(path: string): boolean {
		void page.url.pathname;
		const here = currentPath();
		return path === '/' ? here === '/' : here === path || here.startsWith(path + '/');
	}

	let state = $derived(app.state);

	// Unseen chat messages: direct messages count "major", rooms "minor".
	let chatBadge = $derived.by(() => {
		let major = 0;
		let minor = 0;
		for (const [id, convo] of Object.entries(state.conversationsById)) {
			const chan = state.channelMembership[id];
			if (!chan || (chan.type !== 'room' && chan.type !== 'conversation')) continue;
			if (!convo.unseenCount) continue;
			if (convo.user) major += convo.unseenCount;
			else minor += convo.unseenCount;
		}
		return { major, minor };
	});

	// The challenge being negotiated: received proposals and its chat.
	let playBadge = $derived.by(() => {
		const challenge = state.playChallengeId ? state.gamesById[state.playChallengeId] : null;
		if (!challenge) return { major: 0, minor: 0 };
		return {
			major: challenge.receivedProposals ? challenge.receivedProposals.length : 0,
			minor: state.conversationsById[challenge.id]?.unseenCount ?? 0
		};
	});

	let offline = $derived(
		!!state.currentUser &&
			(state.clientState.status === 'loggedOut' || state.clientState.network !== 'online')
	);
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
			{#each tvSections as section (section.path)}
				<a href={resolve(section.path)} aria-current={isCurrent(section.path) ? 'page' : undefined}>
					{section.name}
				</a>
			{/each}
			{#if !config.guestOnly}
				<span class="divider" aria-hidden="true"></span>
				{#each kgsSections as section (section.path)}
					{@const badge =
						section.badge === 'chat' ? chatBadge : section.badge === 'play' ? playBadge : null}
					<a
						href={resolve(section.path)}
						aria-current={isCurrent(section.path) ? 'page' : undefined}
					>
						{section.name}
						{#if badge && !isCurrent(section.path)}
							<UnseenBadge major={badge.major} minor={badge.minor} />
						{/if}
					</a>
				{/each}
			{/if}
		</nav>
		<div class="account">
			{#if state.currentUser}
				<a
					class="who"
					href={resolve('/konto')}
					aria-current={isCurrent('/konto') ? 'page' : undefined}
				>
					<UserName user={state.currentUser} />
				</a>
			{:else if !config.guestOnly}
				<a class="who" href={resolve('/beobachten')}>Anmelden</a>
			{/if}
			<a
				class="settings"
				href={resolve('/einstellungen')}
				aria-current={isCurrent('/einstellungen') ? 'page' : undefined}
				aria-label="Einstellungen"
				title="Einstellungen"
			>
				⚙
			</a>
		</div>
	</header>

	{#if offline}
		<OfflineAlert />
	{/if}

	<main>
		{@render children()}
	</main>

	{#if state.userDetailsRequest}
		<UserDetailsModal />
	{/if}
	{#if state.showUnderConstruction}
		<UnderConstructionModal onClose={() => app.actions.onHideUnderConstruction()} />
	{/if}
	{#if state.showFeedbackModal}
		<FeedbackModal
			currentUser={state.currentUser}
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

	nav {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
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
