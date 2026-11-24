<script lang="ts">
	// Nachspielen: the board large, beside it the game, variations, KataGo and
	// the curve; below the games played last and the tournament games.
	// Opens, in this order: ?sgf=<address>, the KGS game handed over after it
	// ended (app.state.tvReplayGameId), else the loader (file or SGF text).
	import { onDestroy, onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.ts';
	import { fetchTvEvents } from '#lib/model/tv.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { applyOgsLinks, loadOgsLinks } from '#lib/model/OgsLinks.ts';
	import SgfReplayView from '#lib/ui/tv/SgfReplayView.svelte';
	import RecentlyReplayed from '#lib/ui/tv/RecentlyReplayed.svelte';
	import RecentReplays from '#lib/ui/tv/RecentReplays.svelte';

	// Calendar data and "now" are refreshed like the old TV screen did.
	const REFRESH_MS = 60000;

	let sgfUrl = $derived(page.url.searchParams.get('sgf') || null);
	let replayGameId = $derived(app.state.tvReplayGameId ?? null);
	let replayTree = $derived(
		!sgfUrl && replayGameId ? (app.state.gamesById[replayGameId]?.tree ?? null) : null
	);
	let viewKey = $derived(
		sgfUrl ? 'url:' + sgfUrl : replayTree ? 'game-' + String(replayGameId) : 'manual'
	);

	let events = $state.raw<Array<TvEvent>>([]);
	let now = $state(Date.now());
	let mounted = true;
	let timer: ReturnType<typeof setInterval> | null = null;

	function loadEvents() {
		fetchTvEvents().then(
			(loaded) => {
				if (mounted) events = applyOgsLinks(loaded, loadOgsLinks());
			},
			(err: unknown) => {
				console.warn('[tv] Failed to load calendar events:', err);
			}
		);
	}

	onMount(() => {
		loadEvents();
		timer = setInterval(() => {
			now = Date.now();
			loadEvents();
		}, REFRESH_MS);
	});

	onDestroy(() => {
		mounted = false;
		if (timer) clearInterval(timer);
	});

	// The board sits above the game lists: bring it into view after a game
	// was opened from them.
	let replayElement: HTMLElement | undefined = $state();
	let scrollPending = false;

	function scrollToReplay() {
		void tick().then(() => replayElement?.scrollIntoView({ block: 'start' }));
	}

	function openReplay(url: string) {
		if (url === sgfUrl) {
			scrollToReplay();
			return;
		}
		scrollPending = true;
		app.openReplay(url);
	}

	$effect(() => {
		void sgfUrl;
		if (scrollPending) {
			scrollPending = false;
			scrollToReplay();
		}
	});
</script>

<svelte:head>
	<title>Nachspielen – GoTV</title>
</svelte:head>

<h1 class="visually-hidden">Nachspielen</h1>

<div class="page">
	<div class="replay" bind:this={replayElement}>
		{#key viewKey}
			<SgfReplayView
				initialUrl={sgfUrl}
				initialTree={replayTree}
				replayKey={replayTree ? 'kgs-' + String(replayGameId) : null}
			/>
		{/key}
	</div>

	<div class="lists">
		<RecentlyReplayed onOpenReplay={openReplay} refreshKey={sgfUrl} />
		<RecentReplays {events} {now} onOpenReplay={openReplay} />
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.replay {
		scroll-margin-top: 8px;
	}

	.lists {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: var(--gap);
		align-items: start;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
</style>
