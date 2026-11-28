<script lang="ts">
	// Live: the broadcasts running right now - stream on the left, boards on
	// the right - and below them what is on the channels, the tournaments
	// that just ended, "Mein GoTV" and "Meine Daten". Works without a KGS
	// login: streams, OGS boards and replays need none; KGS boards appear
	// once logged in. Nothing running: the next event and an example.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { app } from '#lib/app.svelte.ts';
	import {
		fetchTvChannels,
		fetchTvEvents,
		getBroadcastForStream,
		getNextUpcomingEvent
	} from '#lib/model/tv.ts';
	import type { TvBroadcast, TvChannel, TvEvent } from '#lib/model/tv.ts';
	import { getChannelsOnAir } from '#lib/model/tvChannels.ts';
	import { kgsTvSource } from '#lib/model/TvSource.ts';
	import { applyOgsLinks, loadOgsLinks, saveOgsLinks } from '#lib/model/OgsLinks.ts';
	import {
		loadFavorites,
		loadRemindersEnabled,
		saveFavorites,
		saveRemindersEnabled,
		toggleFavorite
	} from '#lib/model/TvFavorites.ts';
	import Spinner from '#lib/ui/Spinner.svelte';
	import BackupPanel from '#lib/ui/tv/BackupPanel.svelte';
	import BroadcastCard from '#lib/ui/tv/BroadcastCard.svelte';
	import { formatEventDateRange } from '#lib/ui/tv/eventDate.ts';
	import CinemaExample from '#lib/ui/tv/CinemaExample.svelte';
	import MyGoTv from '#lib/ui/tv/MyGoTv.svelte';
	import KgsNow from '#lib/ui/tv/KgsNow.svelte';
	import FollowedPlayers from '#lib/ui/user/FollowedPlayers.svelte';
	import { config } from '#lib/config.ts';
	import OfflineNotice from '#lib/ui/tv/OfflineNotice.svelte';
	import RecentReplays from '#lib/ui/tv/RecentReplays.svelte';
	import { getNotificationPermission } from '#lib/ui/tv/reminders.ts';
	import StreamEmbed from '#lib/ui/tv/StreamEmbed.svelte';

	// "now" and the calendar are refreshed every minute, as before.
	const REFRESH_MS = 60000;

	let eventsStatus: 'loading' | 'ready' | 'error' = $state('loading');
	let rawEvents = $state.raw<Array<TvEvent>>([]);
	let channels = $state.raw<Array<TvChannel>>([]);
	let now = $state(Date.now());
	// OGS boards the viewer assigned to events by hand (this browser only).
	let ogsLinks = $state.raw(loadOgsLinks());
	// "Mein GoTV" stars and reminders (this browser only).
	let favorites = $state.raw(loadFavorites());
	let remindersEnabled = $state(loadRemindersEnabled());
	let notificationPermission: string | null = $state(getNotificationPermission());
	let mounted = false;

	function loadChannels() {
		fetchTvChannels().then(
			(loaded) => {
				if (mounted) channels = loaded;
			},
			(err: unknown) => console.warn('[tv] Failed to load channels:', err)
		);
	}

	function loadEvents() {
		loadChannels();
		fetchTvEvents().then(
			(loaded) => {
				if (!mounted) return;
				rawEvents = loaded;
				eventsStatus = 'ready';
			},
			(err: unknown) => {
				console.warn('[tv] Failed to load live calendar events:', err);
				if (mounted && !rawEvents.length) eventsStatus = 'error';
			}
		);
	}

	onMount(() => {
		mounted = true;
		window.scrollTo(0, 0);
		loadEvents();
		const timer = setInterval(() => {
			now = Date.now();
			loadEvents();
		}, REFRESH_MS);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	});

	function onToggleEventFavorite(eventId: string) {
		favorites = toggleFavorite(favorites, 'events', eventId);
		saveFavorites(favorites);
	}

	function onToggleReminders() {
		const enabled = !(remindersEnabled && notificationPermission === 'granted');
		saveRemindersEnabled(enabled);
		remindersEnabled = enabled;
		if (enabled && notificationPermission === 'default') {
			void Promise.resolve(window.Notification.requestPermission()).then((permission) => {
				if (mounted) notificationPermission = permission;
			});
		}
	}

	function onAssignOgsLink(eventId: string, gameId: number | null) {
		const next = { ...ogsLinks };
		if (gameId) next[eventId] = gameId;
		else delete next[eventId];
		saveOgsLinks(next);
		ogsLinks = next;
	}

	let date = $derived(new Date(now));
	let tvEvents = $derived(applyOgsLinks(rawEvents, ogsLinks));
	let broadcasts = $derived(
		kgsTvSource.getLiveBroadcasts(app.state.activeGames, tvEvents, app.state.roomsById, date)
	);
	let onAirChannels = $derived(getChannelsOnAir(channels, date));
	let nextEvent = $derived(getNextUpcomingEvent(tvEvents, date));
	let tvStreamUrl = $derived(app.state.tvStreamUrl);
	let openedBroadcast = $derived(
		tvStreamUrl ? getBroadcastForStream(broadcasts, tvStreamUrl) : null
	);
	// The broadcast opened from the chat stands on top, not twice.
	let listedBroadcasts = $derived(
		openedBroadcast
			? broadcasts.filter(({ event }) => event.id !== openedBroadcast.event.id)
			: broadcasts
	);
</script>

<svelte:head>
	<title>{t('app.live.pageTitle')}</title>
</svelte:head>

{#snippet broadcastCard(broadcast: TvBroadcast)}
	<BroadcastCard
		{broadcast}
		onOpenReplay={(url: string) => app.openReplay(url)}
		{now}
		{onAssignOgsLink}
		hasManualOgsLink={!!ogsLinks[broadcast.event.id]}
		favorite={favorites.events.includes(broadcast.event.id)}
		onToggleFavorite={onToggleEventFavorite}
	/>
{/snippet}

<div class="live">
	<OfflineNotice />

	{#if tvStreamUrl}
		<section class="opened" aria-labelledby="opened-title">
			<header class="opened-head">
				<h2 id="opened-title" class="panel-title">{t('app.live.streamFromChat')}</h2>
				<button
					type="button"
					class="button opened-close"
					aria-label={t('app.live.closeStream')}
					title={t('app.live.closeStream')}
					onclick={() => app.actions.onCloseTvStream()}
				>
					×
				</button>
			</header>
			{#if openedBroadcast}
				{#key openedBroadcast.event.id}
					{@render broadcastCard(openedBroadcast)}
				{/key}
			{:else}
				{#key tvStreamUrl}
					<div class="opened-stream">
						<StreamEmbed url={tvStreamUrl} />
						<p class="muted">{t('app.live.noKgsBoard')}</p>
					</div>
				{/key}
			{/if}
		</section>
	{/if}

	{#if eventsStatus === 'loading'}
		<Spinner label={t('app.live.loading')} />
	{:else if broadcasts.length}
		<h1 class="live-title">
			<span class="dot" aria-hidden="true"></span>{t('app.live.runningNow')}
		</h1>
		{#each listedBroadcasts as broadcast (broadcast.event.id)}
			{@render broadcastCard(broadcast)}
		{/each}
	{:else}
		<section class="empty" aria-labelledby="empty-title">
			<div>
				<h1 id="empty-title">{t('app.live.noBroadcast')}</h1>
				{#if eventsStatus === 'error'}
					<p class="muted" role="alert">
						{t('app.live.calendarError')}
					</p>
				{:else if nextEvent}
					<p class="next">
						{t('app.live.nextEvent')} <strong>{nextEvent.name}</strong> ({formatEventDateRange(
							nextEvent
						)})
					</p>
				{/if}
			</div>
			<a class="button button-primary" href={resolve('/kalender')}>{t('app.live.toCalendar')}</a>
		</section>
		<CinemaExample />
	{/if}

	{#if !config.guestOnly}
		<KgsNow shownIds={broadcasts.flatMap((broadcast) => broadcast.games.map((game) => game.id))} />
	{/if}

	<div class="below">
		<div class="below-main">
			{#if onAirChannels.length}
				<p class="on-air">
					<span>
						{t('app.live.onAirNow')}
						<strong>{onAirChannels.map((channel) => channel.name).join(', ')}</strong>
					</span>
					<a class="button" href={resolve('/kanaele')}>{t('app.live.toChannels')}</a>
				</p>
			{/if}
			<RecentReplays
				events={tvEvents}
				{now}
				onOpenReplay={(url: string) => app.openReplay(url)}
				justEnded
			/>
			<MyGoTv
				{favorites}
				{channels}
				events={tvEvents}
				{now}
				{remindersEnabled}
				{notificationPermission}
				{onToggleReminders}
			/>
			{#if !config.guestOnly}
				<FollowedPlayers />
			{/if}
		</div>
		<div class="below-side">
			<BackupPanel />
		</div>
	</div>
</div>

<style>
	.live {
		display: flex;
		flex-direction: column;
		gap: calc(var(--gap) * 1.2);
	}

	.live-title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 4px 0 -8px;
		font-size: var(--title-size);
		font-weight: var(--title-weight);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--live);
		box-shadow: 0 0 0 4px var(--accent-soft);
	}

	.opened {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.opened-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.opened-head .panel-title {
		padding: 0;
	}

	.opened-close {
		min-width: 40px;
		justify-content: center;
		font-size: 1.2rem;
		line-height: 1;
	}

	.opened-stream {
		max-width: 900px;
	}

	.opened-stream p {
		margin: 6px 0 0;
	}

	.empty {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 10px 20px;
	}

	.empty h1 {
		margin: 4px 0 0;
		font-size: clamp(1.5rem, 2.6vw, 2.2rem);
		letter-spacing: -0.015em;
	}

	.empty p {
		margin: 4px 0 0;
	}

	.below {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr);
		gap: var(--gap);
		align-items: start;
	}

	.below-main,
	.below-side {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		min-width: 0;
	}

	.on-air {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		margin: 0;
		padding: 10px 14px;
		border-left: 4px solid var(--live);
		border-radius: var(--radius-s);
		background: var(--surface);
	}

	:global([data-design='oldschool']) .live-title {
		margin: 0 0 -4px;
	}

	:global([data-design='oldschool']) .dot {
		border-radius: 0;
		box-shadow: none;
	}

	:global([data-design='oldschool']) .empty h1 {
		font-size: 16px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .on-air {
		border: 2px solid;
		border-color: var(--bevel-light, #ffffff) var(--bevel-dark, #808080) var(--bevel-dark, #808080)
			var(--bevel-light, #ffffff);
		border-left: 4px solid var(--live);
		border-radius: 0;
	}

	@media (max-width: 900px) {
		.below {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
