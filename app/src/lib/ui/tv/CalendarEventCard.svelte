<script lang="ts" module>
	import { formatEventDateRange } from './eventDate.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
</script>

<script lang="ts">
	// A single calendar/live entry: name, date range, optional notes, the
	// official stream embed (two-click), and an optional "SGF nachspielen"
	// shortcut when the event carries a recorded SGF. Used by the Kalender page
	// and by the Live page (currently-live entries, like the old TvScreen).
	import { t } from '#lib/i18n/index.svelte.ts';
	import StreamEmbed from './StreamEmbed.svelte';
	import ReplayGameList from './ReplayGameList.svelte';
	import FavoriteStar from './FavoriteStar.svelte';
	import StreamChat from './StreamChat.svelte';
	import { getEventChat } from '#lib/model/StreamChat.ts';
	import {
		getLiveWindow,
		hasOgsBoard,
		hasOgsReplay,
		hasVideoStream,
		isWatchable
	} from '#lib/model/tv.ts';

	let {
		event,
		onOpenReplay,
		onStreamLoad,
		boardCount,
		ogsBoardCount,
		now,
		showVideo,
		videoLoaded,
		openGames = false,
		favorite = false,
		onToggleFavorite
	}: {
		event: TvEvent;
		// Without it there is no games list and no "SGF nachspielen".
		onOpenReplay?: (sgfUrl: string) => unknown;
		onStreamLoad?: () => unknown;
		// Linked KGS / OGS boards shown next to the stream (Live page).
		boardCount?: number;
		ogsBoardCount?: number;
		now?: number;
		// false: no player and no stream chat ("Nur Brett").
		showVideo?: boolean;
		// Given: the parent decides whether the player is loaded.
		videoLoaded?: boolean;
		// List the finished games right away (a day picked in the month sheet).
		openGames?: boolean;
		// "Mein GoTV" star; without onToggleFavorite there is no star.
		favorite?: boolean;
		onToggleFavorite?: (eventId: string) => unknown;
	} = $props();

	const PLATFORM_LABEL: Record<TvEvent['platform'], string> = {
		youtube: 'YouTube',
		twitch: 'Twitch',
		other: ''
	};

	function getBoardStatus(
		event: TvEvent,
		boardCount: number | undefined,
		ogsBoardCount: number | undefined,
		now: number
	): string {
		const kgsCount = boardCount || 0;
		const ogsCount = ogsBoardCount || 0;
		const total = kgsCount + ogsCount;
		if (total > 0) {
			const boards = t(
				kgsCount && ogsCount
					? 'app.calendarCard.boardsMixed'
					: ogsCount
						? 'app.calendarCard.boardsOgs'
						: 'app.calendarCard.boardsKgs',
				{ count: total }
			);
			return hasVideoStream(event)
				? t('app.calendarCard.liveStreamBoards', { boards })
				: t('app.calendarCard.liveBoards', { boards });
		}
		if (event.sgf_url) {
			return t('app.calendarCard.sgfAvailable');
		}
		if (getLiveWindow(event).end.getTime() < now) {
			return hasOgsReplay(event)
				? t('app.calendarCard.overReplay')
				: t('app.calendarCard.overNoBoard');
		}
		const hasKgs = !!(event.kgs_room || (event.kgs_players && event.kgs_players.length));
		if (hasKgs && hasOgsBoard(event)) {
			return t('app.calendarCard.bothLinked');
		}
		if (hasOgsBoard(event)) {
			if (ogsBoardCount !== 0) return t('app.calendarCard.ogsLinked');
			return hasVideoStream(event)
				? t('app.calendarCard.ogsLinkedWithStream')
				: t('app.calendarCard.ogsLinkedOnOpen');
		}
		if (hasKgs) {
			return boardCount === 0
				? t('app.calendarCard.kgsLinkedNone')
				: t('app.calendarCard.kgsLinked');
		}
		return t('app.calendarCard.streamOnly');
	}

	let currentTime = $derived(now === undefined ? Date.now() : now);
	let platformLabel = $derived(PLATFORM_LABEL[event.platform]);
	// Finished games can be replayed once the event has begun.
	let canReplayOgs = $derived(
		hasOgsReplay(event) && getLiveWindow(event).start.getTime() <= currentTime
	);
	// The stream's own chat, once the event is running (or about to).
	let chat = $derived.by(() => {
		const info = getEventChat(event, window.location.hostname);
		if (!info || !now) return null;
		const liveWindow = getLiveWindow(event);
		if (now < liveWindow.start.getTime() || now > liveWindow.end.getTime()) return null;
		return info;
	});
</script>

<article class="CalendarEvent">
	<header class="CalendarEvent-header">
		<h3 class="CalendarEvent-name">
			{#if onToggleFavorite}
				<FavoriteStar
					active={favorite}
					name={event.name}
					onToggle={() => onToggleFavorite(event.id)}
				/>
			{/if}
			<span>{event.name}</span>
		</h3>
		{#if platformLabel}
			<span class="CalendarEvent-badge CalendarEvent-badge-{event.platform}">{platformLabel}</span>
		{/if}
	</header>
	<p class="CalendarEvent-date">{formatEventDateRange(event)}</p>
	{#if event.notes}
		<p class="CalendarEvent-notes">{event.notes}</p>
	{/if}
	{#if isWatchable(event) || event.sgf_url}
		<p
			class="CalendarEvent-board-status"
			class:CalendarEvent-board-status-linked={!!(boardCount || ogsBoardCount)}
		>
			{getBoardStatus(event, boardCount, ogsBoardCount, currentTime)}
		</p>
	{/if}
	{#if showVideo !== false}
		<StreamEmbed {event} onLoad={onStreamLoad} loaded={videoLoaded} />
		{#if chat}
			<StreamChat {chat} title={event.name} />
		{/if}
	{/if}
	{#if onOpenReplay && canReplayOgs}
		<div class="CalendarEvent-replay">
			<ReplayGameList {event} {onOpenReplay} defaultOpen={openGames} />
		</div>
	{/if}
	{#if event.sgf_url && onOpenReplay}
		{@const sgfUrl = event.sgf_url}
		<div class="CalendarEvent-replay">
			<button type="button" class="button" onclick={() => onOpenReplay(sgfUrl)}>
				{t('app.calendarCard.replaySgf')}
			</button>
		</div>
	{/if}
</article>

<style>
	.CalendarEvent {
		min-width: 0;
		padding: 14px 16px 16px;
		border: var(--panel-border);
		border-color: var(--rule);
		border-radius: var(--radius-m);
		background: var(--surface);
	}

	.CalendarEvent-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.CalendarEvent-name {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.CalendarEvent-name :global(.FavoriteStar) {
		margin-left: -6px;
		flex: none;
	}

	.CalendarEvent-badge {
		flex: none;
		margin-top: 2px;
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		color: #ffffff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.3px;
	}

	.CalendarEvent-badge-youtube {
		background: #c4302b;
	}

	.CalendarEvent-badge-twitch {
		background: #6441a5;
	}

	.CalendarEvent-date {
		margin: 4px 0 0;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}

	.CalendarEvent-notes {
		margin: 6px 0 0;
		color: var(--ink-soft);
		font-size: 0.92em;
	}

	.CalendarEvent-board-status {
		margin: 8px 0 0;
		padding: 4px 10px;
		border-left: 3px solid var(--rule);
		background: var(--surface-sunk);
		font-size: 0.88em;
	}

	.CalendarEvent-board-status-linked {
		border-left-color: var(--accent);
		background: var(--accent-soft);
	}

	.CalendarEvent-replay {
		margin-top: 8px;
	}

	:global([data-design='oldschool']) .CalendarEvent {
		padding: 6px 8px 8px;
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .CalendarEvent-name {
		font-size: 13px;
		font-weight: 700;
	}

	:global([data-design='oldschool']) .CalendarEvent-badge {
		border-radius: 0;
	}

	:global([data-design='oldschool']) .CalendarEvent-board-status {
		background: var(--paper, #ffffff);
		border: 1px solid #808080;
		border-left-width: 3px;
	}

	:global([data-design='oldschool']) .CalendarEvent-board-status-linked {
		border-left-color: var(--accent);
	}
</style>
