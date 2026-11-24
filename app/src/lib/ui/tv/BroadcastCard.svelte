<script module lang="ts">
	import type { GameChannel } from '#lib/model/types.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/index.svelte.ts';

	type GameStatus = 'running' | 'paused' | 'adjourned' | 'over';

	// "Partie läuft" for a single game, "2 Partien laufen" for several.
	const STATUS_SINGLE: Record<GameStatus, MessageKey> = {
		running: 'tv.status.oneRunning',
		paused: 'tv.status.onePaused',
		adjourned: 'tv.status.oneAdjourned',
		over: 'tv.status.oneOver'
	};
	const STATUS_COUNT: Record<GameStatus, MessageKey> = {
		running: 'tv.status.running',
		paused: 'tv.status.paused',
		adjourned: 'tv.status.adjourned',
		over: 'tv.status.over'
	};

	// Share of the width the stream gets next to the board, in percent.
	export const CINEMA_SPLIT_KEY = 'gotv.cinemaSplit';
	export const CINEMA_SPLIT_DEFAULT = 60;
	export const CINEMA_SPLIT_MIN = 30;
	export const CINEMA_SPLIT_MAX = 80;

	export function clampSplit(value: unknown): number {
		const split = Number(value);
		return value !== null && split >= CINEMA_SPLIT_MIN && split <= CINEMA_SPLIT_MAX
			? split
			: CINEMA_SPLIT_DEFAULT;
	}

	function loadCinemaSplit(): number {
		try {
			return clampSplit(window.localStorage.getItem(CINEMA_SPLIT_KEY));
		} catch {
			return CINEMA_SPLIT_DEFAULT; // storage disabled
		}
	}

	// What decides which OGS board an event shows.
	function getOgsAssignment(event: TvEvent): string {
		return String(event.ogs_game_id || '') + '/' + (event.ogs_players || []).join(',');
	}

	export function getGameKey(game: GameChannel): string {
		return (game.tvSource || 'kgs') + '-' + String(game.id);
	}

	// List metadata only: never join a game to determine its status or move.
	export function getBroadcastStatus(games: Array<GameChannel>): string {
		const counts: Record<GameStatus, number> = { running: 0, paused: 0, adjourned: 0, over: 0 };
		for (const game of games) {
			const status: GameStatus = game.over
				? 'over'
				: game.adjourned
					? 'adjourned'
					: game.paused
						? 'paused'
						: 'running';
			counts[status]++;
		}
		let status = (Object.keys(counts) as Array<GameStatus>)
			.filter((label) => counts[label])
			.map((label) =>
				games.length > 1
					? t(STATUS_COUNT[label], { count: counts[label] })
					: t(STATUS_SINGLE[label])
			)
			.join(' · ');
		if (games.length === 1) {
			const moveNum = games[0].moveNum;
			if (Number.isInteger(moveNum) && moveNum >= 0)
				status += ' · ' + t('tv.status.move', { move: moveNum });
		}
		return status;
	}
</script>

<script lang="ts">
	// One broadcast on Live: the video (two-click embed via CalendarEventCard)
	// on the left, its explicitly assigned KGS/OGS boards on the right. OGS
	// data loads only while the broadcast is open and never needs a KGS
	// login; KGS boards open here when logged in, otherwise on Beobachten.
	// Kinomodus fills the window, the divider between video and board can be
	// dragged (or moved with the arrow keys), the board can lag behind the
	// game server to match the video, and an OGS game link can be assigned
	// by hand. With recordingUrl the card shows a recorded game instead
	// (CinemaExample).
	import { onDestroy, untrack } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { locale } from '#lib/i18n/index.svelte.ts';
	import { ogsTvSource } from '#lib/model/OgsTvSource.ts';
	import { getEmbedUrlForEvent, hasOgsBoard, hasVideoStream } from '#lib/model/tv.ts';
	import type { TvBroadcast } from '#lib/model/tv.ts';
	import { parseOgsGameLink } from '#lib/model/OgsLinks.ts';
	import { DelayBuffer } from '#lib/model/DelayBuffer.ts';
	import {
		DELAY_MAX_SECONDS,
		DELAY_STEP_SECONDS,
		clampDelay,
		loadDelay,
		saveDelay,
		stepDelay
	} from '#lib/model/BoardDelay.ts';
	import GameList from '#lib/ui/game/GameList.svelte';
	import BoardPreviewGrid from './BoardPreviewGrid.svelte';
	import CalendarEventCard from './CalendarEventCard.svelte';
	import SgfReplayView from './SgfReplayView.svelte';
	import TvGamePanel from './TvGamePanel.svelte';

	const DELAY_TICK_MS = 500;
	const SPLIT_KEY_STEP = 2;

	let {
		broadcast,
		onOpenReplay,
		onJoinGame = (gameId: number) => {
			if (app.started) app.actions.onJoinGame(gameId);
		},
		now,
		onAssignOgsLink,
		hasManualOgsLink = false,
		recordingUrl,
		favorite = false,
		onToggleFavorite
	}: {
		broadcast: TvBroadcast;
		onOpenReplay?: (sgfUrl: string) => unknown;
		// A KGS board while not logged in: watch it on Beobachten.
		onJoinGame?: (gameId: number) => unknown;
		now?: number;
		// "OGS-Partielink zuordnen": gameId null removes the viewer's own link.
		onAssignOgsLink?: (eventId: string, gameId: number | null) => unknown;
		hasManualOgsLink?: boolean;
		// An archived board that needs no KGS/OGS session.
		recordingUrl?: string;
		// "Mein GoTV" star, passed to the card header.
		favorite?: boolean;
		onToggleFavorite?: (eventId: string) => unknown;
	} = $props();

	let streamLoaded = $state(false);
	let videoVisible = $state(true);
	let streamKey = $state(0);
	let selectedGameKey: string | null = $state(null);
	let ogsGames = $state.raw<Array<GameChannel>>([]);
	let ogsError: string | null = $state(null);
	// When OGS last delivered the board without an error.
	let ogsUpdatedAt: number | null = $state(null);
	let linkFormOpen = $state(false);
	let linkInput = $state('');
	let linkError: string | null = $state(null);
	// Kinomodus: stream and board fill the window side by side.
	let cinemaOn = $state(false);
	let cinemaSplit = $state(loadCinemaSplit());
	let cinemaChatHidden = $state(false);
	// Seconds the boards lag behind the game server, to match the video.
	let delaySeconds = $state(untrack(() => loadDelay(broadcast.event)));
	// Bumped by the delay timer so delayed boards catch up without new data.
	let delayTick = $state(0);
	let root: HTMLElement | undefined = $state();

	let releaseOgs: (() => void) | null = null;
	let draggingSplit = false;
	let delayBuffers: Record<string, DelayBuffer<GameChannel>> = {};

	let event = $derived(broadcast.event);
	let kgsGames = $derived(broadcast.games);
	let hasOgs = $derived(hasOgsBoard(event));
	let hasVideo = $derived(hasVideoStream(event));
	// A stream the official player can show here. A YouTube @handle without a
	// video or channel id only offers "Extern öffnen" - then the boards need
	// their own button, or they would never open.
	let embeddable = $derived(hasVideo && !!getEmbedUrlForEvent(event, window.location.hostname));
	let showVideo = $derived(hasVideo && videoVisible);
	let kgsInline = $derived(!!app.state.currentUser && app.started);
	let inline = $derived(streamLoaded && (!!recordingUrl || hasOgs || kgsInline));
	let cinema = $derived(cinemaOn && streamLoaded);

	// Each board as it was delaySeconds ago - the whole snapshot, so moves,
	// result, clocks and chat lag together and nothing spoils the video.
	function getDelayedGames(all: Array<GameChannel>): Array<GameChannel> {
		const delayMs = delaySeconds * 1000;
		if (!delayMs) return all;
		const time = Date.now();
		const buffers: Record<string, DelayBuffer<GameChannel>> = {};
		const delayed = all.map((game) => {
			const key = getGameKey(game);
			const buffer = delayBuffers[key] || new DelayBuffer<GameChannel>();
			buffers[key] = buffer;
			if (buffer.latest() !== game) buffer.push(game, time);
			const delayedGame = buffer.get(time, delayMs, true);
			if (delayedGame) return delayedGame;
			// Not delayMs old yet: a board without moves, result or clocks, so
			// nothing gets ahead of the video.
			const wait = (buffer.oldestAt() ?? time) + delayMs - time;
			return {
				...game,
				tree: undefined,
				score: undefined,
				over: false,
				clocks: undefined,
				moveNum: 0,
				tvDelayWaitSeconds: Math.max(1, Math.ceil(wait / 1000))
			};
		});
		delayBuffers = buffers; // boards that are gone drop their history
		return delayed;
	}

	let games = $derived.by(() => {
		void delayTick;
		return getDelayedGames([...kgsGames, ...ogsGames]);
	});
	let selectedGame = $derived(
		games.find((game) => getGameKey(game) === selectedGameKey) ||
			games.find((game) => !game.over) ||
			games[0]
	);
	let canRenderSelected = $derived(
		!!selectedGame && (selectedGame.tvSource === 'ogs' || kgsInline)
	);
	let showSplitter = $derived(inline && showVideo && (games.length > 0 || !!recordingUrl));
	let hasVideoToggle = $derived(embeddable && (games.length > 0 || !!recordingUrl));

	let boardTitle = $derived.by(() => {
		if (recordingUrl) return t('tv.broadcast.recordingTitle');
		if (kgsGames.length && (hasOgs || ogsGames.length)) {
			return t('tv.broadcast.boardsKgsOgs');
		}
		if (games.length) {
			const source = ogsGames.length ? 'OGS' : 'KGS';
			return t('tv.broadcast.boardsOn', { count: games.length, source });
		}
		if (hasOgs) {
			if (!streamLoaded) {
				return embeddable ? t('tv.broadcast.ogsOnStreamOpen') : t('tv.broadcast.ogsAvailable');
			}
			return event.ogs_game_id ? t('tv.broadcast.ogsLoading') : t('tv.broadcast.ogsAppears');
		}
		return hasVideo ? t('tv.broadcast.noKgsStreamOnly') : t('tv.broadcast.noKgsBoard');
	});

	// Says honestly how fresh the OGS board is, so a stalled board never
	// looks like a running broadcast. Uses the boards as displayed (delayed),
	// so the status spoils nothing.
	let ogsStatus = $derived.by(() => {
		const game = games.find((candidate) => candidate.tvSource === 'ogs');
		if (!game) return null;
		if (ogsError) {
			return {
				kind: 'stale',
				text: ogsUpdatedAt
					? t('tv.ogsStatus.staleSince', {
							time: new Date(ogsUpdatedAt).toLocaleTimeString(locale()),
							error: ogsError
						})
					: t('tv.ogsStatus.stale', { error: ogsError })
			};
		}
		if (game.over) {
			return { kind: 'waiting', text: t('tv.ogsStatus.over') };
		}
		if (game.tvLive) {
			return {
				kind: 'live',
				text: delaySeconds
					? t('tv.ogsStatus.liveDelayed', { seconds: delaySeconds })
					: t('tv.ogsStatus.live')
			};
		}
		return { kind: 'polling', text: t('tv.ogsStatus.polling') };
	});

	function observeOgs() {
		const current = broadcast.event;
		if (!hasOgsBoard(current) || releaseOgs) return;
		releaseOgs = ogsTvSource.observeEvent(current, (game, error) => {
			ogsGames = game ? [game] : [];
			ogsError = error ?? null;
			if (game && !error) ogsUpdatedAt = Date.now();
		});
	}

	function stopOgs() {
		if (releaseOgs) {
			const release = releaseOgs;
			releaseOgs = null;
			release();
		}
	}

	// The assignment changed (e.g. a link was added): switch boards.
	let assignment = $derived(getOgsAssignment(event));
	let lastAssignment: string | null = null;
	$effect(() => {
		const next = assignment;
		if (lastAssignment === null || next === lastAssignment) {
			lastAssignment = next;
			return;
		}
		lastAssignment = next;
		untrack(() => {
			stopOgs();
			ogsGames = [];
			ogsError = null;
			selectedGameKey = null;
			if (streamLoaded) observeOgs();
		});
	});

	// The delay timer only runs while boards are open and delayed.
	let delayNeeded = $derived(!recordingUrl && streamLoaded && delaySeconds > 0);
	$effect(() => {
		if (!delayNeeded) {
			delayBuffers = {};
			return;
		}
		const timer = setInterval(() => delayTick++, DELAY_TICK_MS);
		return () => clearInterval(timer);
	});

	onDestroy(stopOgs);

	function onStreamLoad() {
		streamLoaded = true;
		videoVisible = true;
		observeOgs();
	}

	function onClose() {
		stopOgs();
		if (cinemaOn) exitCinema();
		streamLoaded = false;
		streamKey++;
		selectedGameKey = null;
	}

	function onSelectBoard(gameId: number, picked?: GameChannel) {
		const game = picked || [...kgsGames, ...ogsGames].find((candidate) => candidate.id === gameId);
		if (!game) return;
		const key = getGameKey(game);
		if (game.tvSource === 'ogs') {
			if (!streamLoaded) onStreamLoad();
			selectedGameKey = key;
		} else if (streamLoaded && kgsInline) {
			selectedGameKey = key;
		} else {
			onJoinGame(gameId);
		}
	}

	function enterCinema() {
		cinemaOn = true;
		// Real fullscreen where the browser allows it; the card fills the
		// window either way.
		if (root && typeof root.requestFullscreen === 'function') {
			root.requestFullscreen().catch(() => {});
		}
	}

	function exitCinema() {
		cinemaOn = false;
		if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
			document.exitFullscreen().catch(() => {});
		}
	}

	function onDocumentKeydown(e: KeyboardEvent) {
		if (cinema && e.key === 'Escape') exitCinema();
	}

	function onFullscreenChange() {
		// Leaving fullscreen (Esc, F11) also leaves Kinomodus.
		if (cinemaOn && root && !document.fullscreenElement) cinemaOn = false;
	}

	function setSplit(value: number) {
		cinemaSplit = value;
		try {
			window.localStorage.setItem(CINEMA_SPLIT_KEY, String(value));
		} catch {
			// Not remembered without storage.
		}
	}

	function onStartSplit(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		draggingSplit = true;
		// Capture keeps the divider draggable even across the video iframe.
		const target = e.currentTarget as HTMLElement;
		if (typeof target.setPointerCapture === 'function') {
			try {
				target.setPointerCapture(e.pointerId);
			} catch {
				// a synthetic event has no active pointer
			}
		}
	}

	function onDragSplit(e: PointerEvent) {
		if (!draggingSplit || !root) return;
		const rect = root.getBoundingClientRect();
		if (rect.width > 0) {
			setSplit(
				Math.max(
					CINEMA_SPLIT_MIN,
					Math.min(CINEMA_SPLIT_MAX, Math.round((100 * (e.clientX - rect.left)) / rect.width))
				)
			);
		}
	}

	function onEndSplit() {
		draggingSplit = false;
	}

	function onSplitKeydown(e: KeyboardEvent) {
		let value = cinemaSplit;
		if (e.key === 'ArrowLeft') value = Math.max(CINEMA_SPLIT_MIN, value - SPLIT_KEY_STEP);
		else if (e.key === 'ArrowRight') value = Math.min(CINEMA_SPLIT_MAX, value + SPLIT_KEY_STEP);
		else if (e.key === 'Home') value = CINEMA_SPLIT_MIN;
		else if (e.key === 'End') value = CINEMA_SPLIT_MAX;
		else return;
		e.preventDefault();
		e.stopPropagation(); // Arrow keys resize here instead of stepping moves.
		setSplit(value);
	}

	function setDelay(seconds: number) {
		delaySeconds = seconds;
		saveDelay(broadcast.event, seconds);
	}

	function onSubmitLink(e: SubmitEvent) {
		e.preventDefault();
		const gameId = parseOgsGameLink(linkInput);
		if (!gameId) {
			linkError = t('tv.link.invalid');
			return;
		}
		linkFormOpen = false;
		linkError = null;
		onAssignOgsLink?.(broadcast.event.id, gameId);
	}
</script>

<svelte:document onkeydown={onDocumentKeydown} onfullscreenchange={onFullscreenChange} />

{#snippet videoToggle()}
	<button
		type="button"
		class="button BroadcastCard-video-toggle"
		onclick={() => (videoVisible = !videoVisible)}
	>
		{videoVisible ? t('tv.broadcast.boardOnly') : t('tv.broadcast.showVideo')}
	</button>
{/snippet}

{#snippet delayControl()}
	<div class="BroadcastCard-delay" role="group" aria-label={t('tv.delay.label')}>
		<label>
			<span>{t('tv.delay.label')}</span>
			<input
				type="range"
				min={0}
				max={DELAY_MAX_SECONDS}
				value={delaySeconds}
				oninput={(e) => setDelay(clampDelay(e.currentTarget.value))}
			/>
		</label>
		<span class="BroadcastCard-delay-value" aria-live="polite">
			{delaySeconds ? String(delaySeconds) + ' s' : t('tv.delay.off')}
		</span>
		<button
			type="button"
			class="button BroadcastCard-delay-earlier"
			title={t('tv.delay.earlier', { seconds: DELAY_STEP_SECONDS })}
			aria-label={t('tv.delay.earlier', { seconds: DELAY_STEP_SECONDS })}
			disabled={!delaySeconds}
			onclick={() => setDelay(stepDelay(delaySeconds, -1))}
		>
			−{DELAY_STEP_SECONDS} s
		</button>
		<button
			type="button"
			class="button BroadcastCard-delay-later"
			title={t('tv.delay.later', { seconds: DELAY_STEP_SECONDS })}
			aria-label={t('tv.delay.later', { seconds: DELAY_STEP_SECONDS })}
			disabled={delaySeconds >= DELAY_MAX_SECONDS}
			onclick={() => setDelay(stepDelay(delaySeconds, 1))}
		>
			+{DELAY_STEP_SECONDS} s
		</button>
	</div>
{/snippet}

{#snippet linkForm()}
	{#if !linkFormOpen}
		<div class="BroadcastCard-link">
			<button
				type="button"
				class="BroadcastCard-link-toggle"
				onclick={() => {
					linkFormOpen = true;
					linkInput = '';
					linkError = null;
				}}
			>
				{t('tv.link.assign')}
			</button>
			{#if hasManualOgsLink}
				<button
					type="button"
					class="BroadcastCard-link-toggle BroadcastCard-link-remove"
					onclick={() => onAssignOgsLink?.(broadcast.event.id, null)}
				>
					{t('tv.link.remove')}
				</button>
			{/if}
		</div>
	{:else}
		<form class="BroadcastCard-link" onsubmit={onSubmitLink}>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="BroadcastCard-link-input"
				type="text"
				aria-label={t('tv.link.inputLabel')}
				autofocus
				placeholder="https://online-go.com/game/…"
				bind:value={linkInput}
				oninput={() => (linkError = null)}
			/>
			<button class="button button-primary" type="submit">{t('tv.link.submit')}</button>
			<button
				class="button"
				type="button"
				onclick={() => {
					linkFormOpen = false;
					linkError = null;
				}}
			>
				{t('tv.cancel')}
			</button>
			{#if linkError}
				<p class="BroadcastCard-link-error" role="alert">{linkError}</p>
			{/if}
		</form>
	{/if}
{/snippet}

<article
	class="BroadcastCard-frame"
	class:BroadcastCard-frame-cinema={cinema}
	aria-label={event.name}
>
	<div
		class="BroadcastCard"
		class:BroadcastCard-open={inline}
		class:BroadcastCard-boardonly={streamLoaded && !showVideo}
		class:BroadcastCard-cinema={cinema}
		class:BroadcastCard-cinema-boardonly={cinema && !showVideo}
		class:BroadcastCard-cinema-single={cinema && games.length <= 1}
		class:BroadcastCard-cinema-nochat={cinema && cinemaChatHidden}
		style:grid-template-columns={inline && showVideo ? cinemaSplit + '% minmax(0, 1fr)' : undefined}
		bind:this={root}
	>
		{#if showSplitter}
			<!-- A slider: screen readers announce the split in percent. -->
			<div
				class="BroadcastCard-splitter"
				role="slider"
				aria-label={t('tv.split.resize')}
				aria-orientation="horizontal"
				aria-valuemin={CINEMA_SPLIT_MIN}
				aria-valuemax={CINEMA_SPLIT_MAX}
				aria-valuenow={cinemaSplit}
				aria-valuetext={t('tv.split.valueText', { percent: cinemaSplit })}
				tabindex="0"
				style:left="{cinemaSplit}%"
				onpointerdown={onStartSplit}
				onpointermove={onDragSplit}
				onpointerup={onEndSplit}
				onpointercancel={onEndSplit}
				onlostpointercapture={onEndSplit}
				onkeydown={onSplitKeydown}
			></div>
		{/if}
		{#if cinema}
			<div class="BroadcastCard-cinema-bar">
				<h2 class="BroadcastCard-cinema-title">{event.name}</h2>
				{#if showVideo}
					<label class="BroadcastCard-cinema-split">
						{t('tv.split.stream')}
						<input
							type="range"
							min={CINEMA_SPLIT_MIN}
							max={CINEMA_SPLIT_MAX}
							value={cinemaSplit}
							aria-label={t('tv.split.label')}
							oninput={(e) => setSplit(clampSplit(e.currentTarget.value))}
						/>
						{t('tv.split.board')}
					</label>
				{/if}
				{#if hasVideoToggle}
					{@render videoToggle()}
				{/if}
				{#if !recordingUrl}
					{@render delayControl()}
					<button
						type="button"
						class="button BroadcastCard-cinema-chat"
						onclick={() => (cinemaChatHidden = !cinemaChatHidden)}
					>
						{cinemaChatHidden ? t('tv.cinema.showChat') : t('tv.cinema.hideChat')}
					</button>
				{/if}
				<button
					type="button"
					class="button button-primary BroadcastCard-cinema-exit"
					onclick={exitCinema}
				>
					{t('tv.cinema.exit')}
				</button>
			</div>
		{/if}

		<div class="BroadcastCard-event">
			{#key streamKey}
				<CalendarEventCard
					{event}
					{onOpenReplay}
					{onStreamLoad}
					boardCount={kgsGames.length}
					ogsBoardCount={ogsGames.length}
					{now}
					showVideo={!streamLoaded || videoVisible}
					videoLoaded={streamLoaded}
					{favorite}
					{onToggleFavorite}
				/>
			{/key}
		</div>

		<div class="BroadcastCard-boards">
			{#if streamLoaded}
				<div class="BroadcastCard-controls">
					<button type="button" class="button BroadcastCard-close" onclick={onClose}>
						{t('tv.broadcast.close')}
					</button>
					<button type="button" class="button BroadcastCard-cinema-enter" onclick={enterCinema}>
						{t('tv.cinema.enter')}
					</button>
					{#if hasVideoToggle}
						{@render videoToggle()}
					{/if}
					{#if !recordingUrl}
						{@render delayControl()}
					{/if}
				</div>
			{:else if !embeddable && (hasOgs || (kgsInline && games.length))}
				<!-- No stream to load: the boards open with their own button. -->
				<button
					type="button"
					class="button button-primary BroadcastCard-open-boards"
					onclick={onStreamLoad}
				>
					{games.length > 1 ? t('tv.broadcast.openBoards') : t('tv.broadcast.openBoard')}
				</button>
			{/if}
			<h3 class="BroadcastCard-boards-title">{boardTitle}</h3>
			{#if onAssignOgsLink}
				{@render linkForm()}
			{/if}
			{#if ogsError && !ogsGames.length}
				<p class="BroadcastCard-notice" role="alert">
					{t('tv.broadcast.ogsFailed', { error: ogsError })}
				</p>
			{/if}
			{#if games.length}
				<p class="BroadcastCard-boards-status">{getBroadcastStatus(games)}</p>
			{/if}
			{#if ogsStatus}
				<p class="BroadcastCard-ogs-status BroadcastCard-ogs-status-{ogsStatus.kind}" role="status">
					{ogsStatus.text}
				</p>
			{/if}
			{#if games.length > 1}
				<BoardPreviewGrid
					{games}
					selectedKey={selectedGame ? getGameKey(selectedGame) : null}
					getKey={getGameKey}
					onSelect={onSelectBoard}
				/>
			{:else if games.length}
				<div class="BroadcastCard-list">
					<GameList {games} roomsById={app.state.roomsById} showSource onSelect={onSelectBoard} />
				</div>
			{/if}
			{#if inline && canRenderSelected && selectedGame}
				{#key getGameKey(selectedGame)}
					<TvGamePanel game={selectedGame} />
				{/key}
			{/if}
			{#if streamLoaded && recordingUrl}
				<SgfReplayView initialUrl={recordingUrl} compact />
			{:else if recordingUrl}
				<p class="BroadcastCard-recording-hint muted">
					{t('tv.broadcast.recordingHint')}
				</p>
			{/if}
		</div>
	</div>
</article>

<style>
	/* The card adapts to its own width (Live, a Kalender row, Kanäle). No
	   container in Kinomodus: it would hold the fixed layer inside. */
	.BroadcastCard-frame {
		container-type: inline-size;
		min-width: 0;
	}

	.BroadcastCard-frame-cinema {
		container-type: normal;
	}

	.BroadcastCard {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr);
		gap: var(--gap);
		align-items: start;
	}

	.BroadcastCard-event {
		min-width: 0;
	}

	/* The video on its dark stage, 16:9 also before the click. */
	.BroadcastCard-event :global(.StreamEmbed-placeholder) {
		aspect-ratio: 16 / 9;
		justify-content: center;
	}

	.BroadcastCard-boards {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		padding: 12px 14px 14px;
		border: var(--panel-border);
		border-color: var(--rule);
		border-radius: var(--radius-m);
		background: var(--surface);
	}

	.BroadcastCard-boards p,
	.BroadcastCard-boards h3 {
		margin: 0;
	}

	.BroadcastCard-boards-title {
		font-size: var(--title-size);
		font-weight: var(--title-weight);
	}

	.BroadcastCard-boards-status,
	.BroadcastCard-notice {
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.BroadcastCard-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--rule);
	}

	/* One row of compact buttons, so the board stays in view (iPad). */
	.BroadcastCard-controls .button {
		padding: 5px 12px;
		font-size: 0.92em;
	}

	.BroadcastCard-open-boards {
		align-self: flex-start;
	}

	.BroadcastCard-delay {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 0.88em;
	}

	.BroadcastCard-delay label {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.BroadcastCard-delay input {
		width: 110px;
		accent-color: var(--accent);
	}

	.BroadcastCard-delay-value {
		min-width: 36px;
		font-variant-numeric: tabular-nums;
	}

	.BroadcastCard-delay .button {
		padding: 4px 10px;
	}

	.button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.BroadcastCard-link {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
	}

	.BroadcastCard-link-toggle {
		min-height: 32px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font-size: 0.9em;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.BroadcastCard-link-remove {
		color: var(--ink-soft);
	}

	.BroadcastCard-link-input {
		flex: 1;
		min-width: 180px;
		min-height: 34px;
		padding: 5px 10px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}

	.BroadcastCard-link-error {
		flex-basis: 100%;
		color: var(--danger, #b3261e);
		font-size: 0.9em;
	}

	.BroadcastCard-ogs-status {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-soft);
		font-size: 0.88em;
	}

	.BroadcastCard-ogs-status::before {
		content: '';
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink-soft);
	}

	.BroadcastCard-ogs-status-live::before {
		background: var(--live);
	}

	.BroadcastCard-ogs-status-stale {
		color: var(--danger, #b3261e);
	}

	.BroadcastCard-ogs-status-stale::before {
		background: #b3261e;
	}

	/* The divider between video and board. */
	.BroadcastCard-splitter {
		position: absolute;
		z-index: 4;
		top: 0;
		bottom: 0;
		width: 16px;
		/* Centred in the gap after the video column. */
		transform: translateX(calc(var(--gap) / 2 - 50%));
		cursor: col-resize;
		touch-action: none;
		user-select: none;
	}

	.BroadcastCard-splitter::after {
		content: '';
		position: absolute;
		top: calc(50% - 24px);
		left: 6px;
		width: 4px;
		height: 48px;
		border-radius: 3px;
		background: var(--accent);
	}

	.BroadcastCard-splitter:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -3px;
	}

	/* Video switched off: the board alone, centred. */
	.BroadcastCard-boardonly:not(.BroadcastCard-cinema) {
		grid-template-columns: minmax(0, 1fr);
	}

	.BroadcastCard-boardonly:not(.BroadcastCard-cinema) .BroadcastCard-boards {
		width: 100%;
		max-width: 720px;
		justify-self: center;
	}

	/* Kinomodus: the whole broadcast fills the window - stream left, board
	   right. Only classes change, so the stream iframe keeps playing. */
	.BroadcastCard-cinema {
		position: fixed;
		inset: 0;
		z-index: 1000;
		grid-template-rows: auto minmax(0, 1fr);
		align-items: stretch;
		gap: 0;
		background: var(--bg);
		overflow: hidden;
	}

	.BroadcastCard-cinema-bar {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		padding: 6px 12px;
		background: var(--stage);
		color: var(--stage-ink);
		font-size: 0.9em;
	}

	.BroadcastCard-cinema-bar .button:not(.button-primary) {
		background: transparent;
		border-color: rgba(255, 255, 255, 0.35);
		color: var(--stage-ink);
	}

	.BroadcastCard-cinema-title {
		flex: 1;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-size: 1em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.BroadcastCard-cinema-split {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.BroadcastCard-cinema-split input {
		width: 140px;
		accent-color: var(--accent);
	}

	.BroadcastCard-cinema .BroadcastCard-event {
		display: flex;
		flex-direction: column;
		justify-content: center;
		background: #000000;
		overflow: hidden;
	}

	.BroadcastCard-cinema .BroadcastCard-event :global(.CalendarEvent) {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
	}

	.BroadcastCard-cinema .BroadcastCard-event :global(.CalendarEvent-header),
	.BroadcastCard-cinema .BroadcastCard-event :global(.CalendarEvent-date),
	.BroadcastCard-cinema .BroadcastCard-event :global(.CalendarEvent-notes),
	.BroadcastCard-cinema .BroadcastCard-event :global(.CalendarEvent-board-status),
	.BroadcastCard-cinema .BroadcastCard-event :global(.CalendarEvent-replay) {
		display: none;
	}

	.BroadcastCard-cinema .BroadcastCard-event :global(.StreamEmbed) {
		width: 100%;
		/* Never taller than the window: 16:9 limited by the free height. */
		max-width: calc((100dvh - 56px) * 16 / 9);
		margin: 0 auto;
	}

	.BroadcastCard-cinema .BroadcastCard-event :global(.StreamEmbed-external) {
		display: none;
	}

	.BroadcastCard-cinema .BroadcastCard-boards {
		border: 0;
		border-radius: 0;
		overflow-y: auto;
	}

	.BroadcastCard-cinema .BroadcastCard-controls,
	.BroadcastCard-cinema .BroadcastCard-link,
	.BroadcastCard-cinema .BroadcastCard-boards-title,
	.BroadcastCard-cinema .BroadcastCard-boards-status {
		display: none;
	}

	/* One board needs no list to choose from. */
	.BroadcastCard-cinema-single .BroadcastCard-list {
		display: none;
	}

	.BroadcastCard-cinema :global(.TvGamePanel-board-section) {
		max-width: calc(100dvh - 330px);
	}

	.BroadcastCard-cinema-boardonly {
		grid-template-columns: minmax(0, 1fr);
	}

	.BroadcastCard-cinema-boardonly .BroadcastCard-event {
		display: none;
	}

	.BroadcastCard-cinema .BroadcastCard-splitter {
		top: 48px;
	}

	.BroadcastCard-cinema-nochat :global(.TvGamePanel-tabs),
	.BroadcastCard-cinema-nochat :global(.TvGamePanel [role='tabpanel']),
	.BroadcastCard-cinema-nochat :global(.TvGamePanel form) {
		display: none;
	}

	/* A recorded game in the board column: never taller than the window. */
	.BroadcastCard :global(.replay.compact) {
		width: 100%;
		max-width: max(240px, calc(100dvh - 190px));
		margin: 0 auto;
	}

	:global([data-design='oldschool']) .BroadcastCard-boards {
		padding: 6px 8px 8px;
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .BroadcastCard-boards-title {
		margin: -6px -8px 2px;
		padding: 3px 6px;
		background: var(--title-bar);
		color: var(--title-ink);
	}

	:global([data-design='oldschool']) .BroadcastCard-controls .button {
		padding: 3px 10px;
		font-size: inherit;
	}

	:global([data-design='oldschool']) .BroadcastCard-link-input {
		border: 2px inset #ece9e2;
		border-radius: 0;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .BroadcastCard-splitter::after {
		border-radius: 0;
	}

	/* Portrait, phone, narrow places: video, then the boards. */
	@container (max-width: 820px) {
		.BroadcastCard:not(.BroadcastCard-cinema) {
			grid-template-columns: minmax(0, 1fr) !important;
		}

		.BroadcastCard:not(.BroadcastCard-cinema) .BroadcastCard-splitter {
			display: none;
		}
	}

	@media (max-width: 700px) {
		.BroadcastCard-cinema {
			grid-template-columns: minmax(0, 1fr) !important;
			grid-template-rows: auto auto minmax(0, 1fr);
			overflow-y: auto;
		}

		.BroadcastCard-cinema .BroadcastCard-splitter {
			display: none;
		}
	}

	.BroadcastCard-recording-hint {
		margin: 8px 0 0;
		font-size: 0.9em;
	}
</style>
