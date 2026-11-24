<script lang="ts">
	// Month sheet of the tournament calendar: a multi-day tournament runs as one
	// bar across its days; clicking a day lists that day's tournaments below.
	import { tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import CalendarEventCard from './CalendarEventCard.svelte';
	import { getLiveWindow, hasOgsReplay, hasVideoStream } from '#lib/model/tv.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { buildMonth, getEventsOnDay, shiftMonth, toDayKey } from '#lib/model/tvCalendar.ts';
	import type { MonthEntry } from '#lib/model/tvCalendar.ts';

	let {
		events,
		now,
		onOpenReplay,
		renderEvent,
		favoriteEventIds = [],
		onToggleFavorite
	}: {
		events: Array<TvEvent>;
		now: number;
		onOpenReplay?: (sgfUrl: string) => unknown;
		// Replaces the plain card (e.g. a live broadcast with its board);
		// options.openGames: the card should list its finished games right away.
		renderEvent?: Snippet<[TvEvent, { openGames: boolean }]>;
		// Starred tournaments ("Mein GoTV") get a "★" in front of their bar.
		favoriteEventIds?: Array<string>;
		onToggleFavorite?: (eventId: string) => unknown;
	} = $props();

	const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	// Rows of tournaments a day cell shows before it says "+N".
	const VISIBLE_SLOTS = 3;
	const SLOTS = Array.from({ length: VISIBLE_SLOTS }, (_, slot) => slot);

	const initial = untrack(() => new Date(now));
	let year = $state(initial.getFullYear());
	let month = $state(initial.getMonth()); // 0-based
	let selectedKey = $state(toDayKey(initial));
	let selectedRef: HTMLElement | undefined = $state();

	function formatMonth(year: number, month: number): string {
		return new Date(year, month, 1).toLocaleDateString('de-DE', {
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDay(dayKey: string): string {
		const [y, m, d] = dayKey.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	// A tournament that has begun and has games to replay (OGS or SGF).
	function canReplay(event: TvEvent): boolean {
		return (hasOgsReplay(event) || !!event.sgf_url) && getLiveWindow(event).start.getTime() <= now;
	}

	function isStarred(event: TvEvent): boolean {
		return favoriteEventIds.includes(event.id);
	}

	function barLabel(entry: MonthEntry): string {
		return (
			(isStarred(entry.event) ? '★ ' : '') + (canReplay(entry.event) ? '▶ ' : '') + entry.event.name
		);
	}

	function step(delta: number) {
		({ year, month } = shiftMonth(year, month, delta));
	}

	function goToday() {
		const today = new Date(now);
		year = today.getFullYear();
		month = today.getMonth();
		selectedKey = toDayKey(today);
	}

	async function selectDay(key: string) {
		selectedKey = key;
		await tick();
		// The day's cards sit below the sheet: bring them into view.
		selectedRef?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
	}

	let todayKey = $derived(toDayKey(new Date(now)));
	let weeks = $derived(buildMonth(events, year, month));
	let dayEvents = $derived(getEventsOnDay(events, selectedKey));
	let monthTitle = $derived(formatMonth(year, month));
</script>

<div class="CalendarMonth">
	<div class="CalendarMonth-header">
		<h2 class="CalendarMonth-title" aria-live="polite">{monthTitle}</h2>
		<div class="CalendarMonth-controls">
			<button
				type="button"
				class="button CalendarMonth-prev"
				aria-label="Vorheriger Monat"
				onclick={() => step(-1)}
			>
				◀
			</button>
			<button type="button" class="button CalendarMonth-today" onclick={goToday}>Heute</button>
			<button
				type="button"
				class="button CalendarMonth-next"
				aria-label="Nächster Monat"
				onclick={() => step(1)}
			>
				▶
			</button>
		</div>
	</div>
	<ul class="CalendarMonth-legend" aria-label="Legende">
		<li class="CalendarMonth-legend-video">mit Stream</li>
		<li class="CalendarMonth-legend-plain">ohne Stream</li>
		<li class="CalendarMonth-legend-replay">▶ Partien zum Nachspielen</li>
	</ul>

	<div class="CalendarMonth-grid panel" role="group" aria-label={monthTitle}>
		{#each WEEKDAYS as weekday (weekday)}
			<div class="CalendarMonth-weekday" aria-hidden="true">{weekday}</div>
		{/each}
		{#each weeks as week (week[0].key)}
			{#each week as cell, index (cell.key)}
				{@const hidden = cell.entries.filter((entry) => entry.slot >= VISIBLE_SLOTS).length}
				{@const names = cell.entries.map((entry) => entry.event.name).join(', ')}
				<button
					type="button"
					data-day={cell.key}
					class="CalendarMonth-day"
					class:CalendarMonth-day-outside={!cell.inMonth}
					class:CalendarMonth-day-today={cell.key === todayKey}
					class:CalendarMonth-day-selected={cell.key === selectedKey}
					aria-pressed={cell.key === selectedKey}
					aria-current={cell.key === todayKey ? 'date' : undefined}
					aria-label={formatDay(cell.key) + (names ? ': ' + names : '')}
					onclick={() => selectDay(cell.key)}
				>
					<span class="CalendarMonth-day-number">{cell.day}</span>
					{#each SLOTS as slot (slot)}
						{@const entry = cell.entries.find((candidate) => candidate.slot === slot)}
						{#if entry}
							<!-- The name shows where the bar begins: first day, or Monday. -->
							<span
								title={entry.event.name}
								class="CalendarMonth-bar"
								class:CalendarMonth-bar-video={hasVideoStream(entry.event)}
								class:CalendarMonth-bar-replay={canReplay(entry.event)}
								class:CalendarMonth-bar-favorite={isStarred(entry.event)}
								class:CalendarMonth-bar-start={entry.isStart}
								class:CalendarMonth-bar-end={entry.isEnd}
							>
								{entry.isStart || index === 0 ? barLabel(entry) : ' '}
							</span>
						{:else}
							<span class="CalendarMonth-bar-gap"></span>
						{/if}
					{/each}
					{#if hidden}
						<span class="CalendarMonth-more">+{hidden} weitere</span>
					{/if}
				</button>
			{/each}
		{/each}
	</div>

	<section class="CalendarMonth-selected" bind:this={selectedRef} aria-live="polite">
		<h2 class="CalendarMonth-selected-title">{formatDay(selectedKey)}</h2>
		{#if dayEvents.length}
			<div class="CalendarMonth-cards">
				{#each dayEvents as event (event.id)}
					{#if renderEvent}
						{@render renderEvent(event, { openGames: true })}
					{:else}
						<CalendarEventCard
							{event}
							{onOpenReplay}
							{now}
							openGames
							favorite={favoriteEventIds.includes(event.id)}
							{onToggleFavorite}
						/>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="CalendarMonth-empty muted">Keine Turniere an diesem Tag.</p>
		{/if}
	</section>
</div>

<style>
	.CalendarMonth-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.CalendarMonth-title {
		margin: 0;
		font-size: clamp(1.2rem, 2vw, 1.5rem);
		letter-spacing: -0.015em;
	}

	.CalendarMonth-controls {
		display: flex;
		gap: 6px;
	}

	.CalendarMonth-controls .button {
		min-height: 36px;
	}

	.CalendarMonth-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin: 8px 0 12px;
		padding: 0;
		list-style: none;
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	.CalendarMonth-legend li::before {
		content: '';
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-right: 6px;
		border-radius: 3px;
		background: var(--bar-plain);
		vertical-align: -1px;
	}

	.CalendarMonth-legend .CalendarMonth-legend-video::before {
		background: var(--accent);
	}

	/* Text only, no colour box: the ▶ is the marker. */
	.CalendarMonth-legend .CalendarMonth-legend-replay::before {
		display: none;
	}

	.CalendarMonth {
		--bar-plain: #c9d1cb;
		--bar-plain-ink: var(--ink);
	}

	.CalendarMonth-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.CalendarMonth-weekday {
		padding: 8px 10px;
		border-bottom: 1px solid var(--rule);
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	.CalendarMonth-day {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		min-height: 108px;
		padding: 6px 0 6px;
		border: 0;
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.CalendarMonth-day:nth-child(7n + 7) {
		border-right: 0;
	}

	.CalendarMonth-day:hover {
		background: var(--surface-sunk);
	}

	.CalendarMonth-day-outside {
		background: var(--surface-sunk);
		color: var(--ink-soft);
	}

	.CalendarMonth-day-outside .CalendarMonth-day-number {
		opacity: 0.6;
	}

	.CalendarMonth-day-number {
		padding: 0 8px;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}

	.CalendarMonth-day-today .CalendarMonth-day-number {
		color: var(--accent);
		font-weight: 700;
	}

	.CalendarMonth-day-selected,
	.CalendarMonth-day-selected:hover {
		background: var(--accent-soft);
	}

	/* One row of a tournament; neighbouring days join into one bar. */
	.CalendarMonth-bar,
	.CalendarMonth-bar-gap {
		display: block;
		height: 20px;
	}

	.CalendarMonth-bar {
		margin-right: -1px; /* over the cell border, so the bar runs on */
		padding: 0 6px;
		overflow: hidden;
		background: var(--bar-plain);
		color: var(--bar-plain-ink);
		font-size: 0.78em;
		line-height: 20px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.CalendarMonth-bar-video {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.CalendarMonth-bar-favorite {
		font-weight: 700;
	}

	.CalendarMonth-bar-start {
		margin-left: 4px;
		border-top-left-radius: var(--radius-s);
		border-bottom-left-radius: var(--radius-s);
	}

	.CalendarMonth-bar-end {
		margin-right: 4px;
		border-top-right-radius: var(--radius-s);
		border-bottom-right-radius: var(--radius-s);
	}

	.CalendarMonth-more {
		padding: 0 8px;
		overflow: hidden;
		color: var(--ink-soft);
		font-size: 0.78em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.CalendarMonth-selected {
		margin-top: calc(var(--gap) * 1.4);
		scroll-margin-top: 12px;
	}

	.CalendarMonth-selected-title {
		margin: 0 0 10px;
		font-size: var(--title-size);
		font-weight: var(--title-weight);
	}

	.CalendarMonth-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
		gap: 12px;
		align-items: start;
	}

	.CalendarMonth-empty {
		margin: 0;
		padding: 8px 0;
	}

	:global([data-design='oldschool']) .CalendarMonth {
		--bar-plain: #fff3c4;
		--bar-plain-ink: #000000;
	}

	:global([data-design='oldschool']) .CalendarMonth-title {
		font-size: 14px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .CalendarMonth-weekday {
		background: var(--surface);
		color: var(--ink);
		font-weight: 700;
	}

	:global([data-design='oldschool']) .CalendarMonth-day {
		min-height: 88px;
		background: var(--surface-sunk);
		border-color: #d4d0c8;
	}

	:global([data-design='oldschool']) .CalendarMonth-day-outside {
		background: #ece9e2;
	}

	:global([data-design='oldschool']) .CalendarMonth-day-selected {
		background: var(--accent-soft);
		outline: 1px dotted #000000;
		outline-offset: -3px;
	}

	:global([data-design='oldschool']) .CalendarMonth-bar {
		border-top: 1px solid #c8b56d;
		border-bottom: 1px solid #c8b56d;
		line-height: 18px;
	}

	:global([data-design='oldschool']) .CalendarMonth-bar-video {
		border-color: var(--accent);
	}

	:global([data-design='oldschool']) .CalendarMonth-legend li::before {
		border: 1px solid #808080;
	}

	:global([data-design='oldschool']) .CalendarMonth-selected {
		padding: 0 6px 6px;
		background: var(--surface);
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .CalendarMonth-selected-title {
		margin: 0 -6px 6px;
		padding: 3px 6px;
		background: var(--title-bar);
		color: var(--title-ink);
	}

	@media (max-width: 640px) {
		.CalendarMonth-day {
			min-height: 64px;
			padding: 4px 0;
		}

		.CalendarMonth-day-number {
			padding: 0 4px;
			font-size: 0.85em;
		}

		.CalendarMonth-bar {
			height: 7px;
			padding: 0;
			font-size: 0;
			line-height: 7px;
		}

		.CalendarMonth-bar-gap {
			height: 7px;
		}

		.CalendarMonth-more {
			padding: 0 4px;
			font-size: 0.7em;
		}

		.CalendarMonth-weekday {
			padding: 6px 4px;
		}
	}
</style>
