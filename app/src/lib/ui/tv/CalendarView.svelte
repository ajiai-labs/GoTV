<script lang="ts">
	// The Kalender: a month sheet (default) or a list grouped by region, with
	// the entries of events.json, refreshed every minute.
	import { onMount, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import CalendarEventCard from './CalendarEventCard.svelte';
	import CalendarMonth from './CalendarMonth.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import {
		fetchTvEvents,
		groupEventsByRegion,
		groupEventsByTime,
		validateTvEvent
	} from '#lib/model/tv.ts';
	import type { TvEvent } from '#lib/model/tv.ts';

	let {
		events: providedEvents,
		onOpenReplay,
		renderEvent,
		favoriteEventIds = [],
		onToggleFavorite
	}: {
		// When provided, these are used instead of fetching events.json (tests),
		// each validated the same way as a fetched entry.
		events?: Array<Record<string, unknown>> | null;
		onOpenReplay?: (sgfUrl: string) => unknown;
		// Replaces the plain card (e.g. a live broadcast with its board).
		renderEvent?: Snippet<[TvEvent, { openGames: boolean }]>;
		favoriteEventIds?: Array<string>;
		onToggleFavorite?: (eventId: string) => unknown;
	} = $props();

	type ViewMode = 'month' | 'list';
	type Region = 'de' | 'intl';

	const VIEW_KEY = 'gotv.calendarView';
	const REFRESH_MS = 60000;
	const REGION_ORDER: Array<Region> = ['de', 'intl'];
	const REGION_LABELS: Record<Region, string> = { de: 'Deutschland', intl: 'International' };
	const VIEWS: Array<[ViewMode, string]> = [
		['month', 'Monat'],
		['list', 'Liste']
	];

	function loadView(): ViewMode {
		try {
			return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'month';
		} catch {
			return 'month'; // storage disabled
		}
	}

	let status: 'loading' | 'ready' | 'error' = $state('loading');
	let events = $state.raw<Array<TvEvent>>([]);
	let now = $state(Date.now());
	let view: ViewMode = $state(loadView());
	let mounted = false;

	function selectView(next: ViewMode) {
		view = next;
		try {
			window.localStorage.setItem(VIEW_KEY, next);
		} catch {
			// Not remembered without storage.
		}
	}

	function applyProvided() {
		const valid: Array<TvEvent> = [];
		for (const raw of providedEvents || []) {
			const event = validateTvEvent(raw);
			if (event) {
				valid.push(event);
			} else {
				console.log('[tv] Skipping invalid calendar entry:', raw);
			}
		}
		events = valid;
		status = 'ready';
	}

	function loadEvents() {
		fetchTvEvents().then(
			(loaded) => {
				if (!mounted) return;
				events = loaded;
				status = 'ready';
			},
			(err: unknown) => {
				console.warn('[tv] Failed to load calendar events:', err);
				if (mounted && status !== 'ready') status = 'error';
			}
		);
	}

	function refresh() {
		if (providedEvents) applyProvided();
		else loadEvents();
	}

	onMount(() => {
		mounted = true;
		untrack(refresh);
		const timer = setInterval(() => {
			now = Date.now();
			refresh();
		}, REFRESH_MS);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	});

	// The Kalender zone (today + upcoming + past) and the Archiv zone are each
	// grouped by region.
	let listGroups = $derived.by(() => {
		if (view !== 'list') return [];
		const timeGroups = groupEventsByTime(events, new Date(now));
		const calendar = groupEventsByRegion([
			...timeGroups.today,
			...timeGroups.upcoming,
			...timeGroups.past
		]);
		const archive = groupEventsByRegion(timeGroups.archive);
		return [
			...REGION_ORDER.map((region) => ({
				key: 'calendar-' + region,
				title: REGION_LABELS[region],
				events: calendar[region]
			})),
			...REGION_ORDER.map((region) => ({
				key: 'archive-' + region,
				title: 'Archiv · ' + REGION_LABELS[region],
				events: archive[region]
			}))
		].filter((group) => group.events.length);
	});
</script>

<div class="CalendarView">
	<div class="CalendarView-top">
		<h1>Kalender</h1>
		{#if status === 'ready'}
			<div class="CalendarView-switch" role="group" aria-label="Ansicht">
				{#each VIEWS as [id, label] (id)}
					<button
						type="button"
						data-view={id}
						class="CalendarView-switch-item"
						class:CalendarView-switch-item-active={view === id}
						aria-pressed={view === id}
						onclick={() => selectView(id)}
					>
						{label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if status === 'loading'}
		<Spinner label="Kalender wird geladen …" />
	{:else if status === 'error'}
		<div class="CalendarView-error panel" role="alert">
			<p>Kalender konnte nicht geladen werden (events.json nicht erreichbar).</p>
			<button type="button" class="button" onclick={loadEvents}>Erneut versuchen</button>
		</div>
	{:else if view === 'month'}
		<CalendarMonth
			{events}
			{now}
			{onOpenReplay}
			{renderEvent}
			{favoriteEventIds}
			{onToggleFavorite}
		/>
	{:else}
		{#each listGroups as group (group.key)}
			<section class="CalendarView-group" aria-labelledby="CalendarView-{group.key}">
				<h2 class="CalendarView-group-title" id="CalendarView-{group.key}">{group.title}</h2>
				<div class="CalendarView-cards">
					{#each group.events as event (event.id)}
						{#if renderEvent}
							{@render renderEvent(event, { openGames: false })}
						{:else}
							<CalendarEventCard
								{event}
								{onOpenReplay}
								{now}
								favorite={favoriteEventIds.includes(event.id)}
								{onToggleFavorite}
							/>
						{/if}
					{/each}
				</div>
			</section>
		{/each}
		{#if !events.length}
			<p class="CalendarView-empty muted">Keine Events im Kalender.</p>
		{/if}
	{/if}
</div>

<style>
	.CalendarView-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin: 8px 0 16px;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 2.6vw, 2.2rem);
		letter-spacing: -0.015em;
	}

	.CalendarView-switch {
		display: inline-flex;
		padding: 3px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-pill);
		background: var(--surface);
	}

	.CalendarView-switch-item {
		min-height: 34px;
		padding: 4px 16px;
		border: 0;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.CalendarView-switch-item-active {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.CalendarView-error {
		padding: 16px;
	}

	.CalendarView-error p {
		margin: 0 0 10px;
	}

	.CalendarView-group {
		margin-bottom: calc(var(--gap) * 1.2);
	}

	.CalendarView-group-title {
		margin: 0 0 10px;
		font-size: var(--title-size);
		font-weight: var(--title-weight);
	}

	.CalendarView-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
		gap: 12px;
		align-items: start;
	}

	.CalendarView-empty {
		margin: 0;
		padding: 16px 0;
	}

	:global([data-design='oldschool']) h1 {
		font-size: 16px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .CalendarView-switch {
		padding: 0;
		gap: 0;
		border: 0;
		border-radius: 0;
		background: none;
	}

	:global([data-design='oldschool']) .CalendarView-switch-item {
		min-height: 26px;
		padding: 2px 12px;
		border: 2px outset #ece9e2;
		border-radius: 0;
		background: var(--button-bg);
		color: var(--ink);
	}

	:global([data-design='oldschool']) .CalendarView-switch-item-active {
		border-style: inset;
		background: var(--accent-soft);
		font-weight: 700;
	}

	:global([data-design='oldschool']) .CalendarView-group {
		padding: 0 6px 6px;
		background: var(--surface);
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .CalendarView-group-title {
		margin: 0 -6px 6px;
		padding: 3px 6px;
		background: var(--title-bar);
		color: var(--title-ink);
	}
</style>
