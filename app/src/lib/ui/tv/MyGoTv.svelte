<script lang="ts">
	// "Mein GoTV" on Live: what the starred channels and tournaments do now
	// and next, with the switch for reminders. Nothing starred: a one-line
	// hint where the stars are. A channel leads to Kanäle, a tournament to the
	// Kalender.
	import { resolve } from '$app/paths';
	import { getMyGoTvItems } from '#lib/model/MyGoTv.ts';
	import type { MyGoTvItem } from '#lib/model/MyGoTv.ts';
	import type { TvChannel, TvEvent } from '#lib/model/tv.ts';
	import type { TvFavorites } from '#lib/model/TvFavorites.ts';

	let {
		favorites,
		channels,
		events,
		now,
		remindersEnabled,
		notificationPermission,
		onToggleReminders
	}: {
		favorites: TvFavorites;
		channels: Array<TvChannel>;
		events: Array<TvEvent>;
		now: number;
		remindersEnabled: boolean;
		// null: the browser has no notifications at all (e.g. some tablets).
		notificationPermission: string | null;
		onToggleReminders: () => unknown;
	} = $props();

	const uid = $props.id();

	function formatDay(date: Date): string {
		return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
	}

	function formatStart(start: Date, today: Date): string {
		const time = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
		if (start.toDateString() === today.toDateString()) return 'heute ' + time + ' Uhr';
		return formatDay(start) + ' ' + time + ' Uhr';
	}

	function describe(item: MyGoTvItem, today: Date): string {
		if (item.status === 'now') return item.planned ? 'läuft gerade (geplant)' : 'läuft gerade';
		if (item.status === 'next' && item.start) {
			const when = item.timed ? formatStart(item.start, today) : formatDay(item.start);
			return item.planned ? 'nächste Sendung ' + when + ' (geplant)' : when;
		}
		return 'keine feste Sendezeit';
	}

	let date = $derived(new Date(now));
	let items = $derived(getMyGoTvItems(favorites, channels, events, date));
</script>

<section class="MyGoTv panel" class:MyGoTv-empty={!items.length} aria-labelledby="{uid}-title">
	<header class="MyGoTv-header">
		<h2 id="{uid}-title" class="panel-title">Mein GoTV</h2>
		{#if items.length && notificationPermission}
			{#if notificationPermission === 'denied'}
				<span class="MyGoTv-reminder-note muted">Erinnerungen sind im Browser blockiert</span>
			{:else}
				<label class="MyGoTv-reminder">
					<input
						type="checkbox"
						checked={remindersEnabled && notificationPermission === 'granted'}
						onchange={() => onToggleReminders()}
					/>
					10 Min. vorher erinnern (solange GoTV offen ist)
				</label>
			{/if}
		{/if}
	</header>
	{#if !items.length}
		<p class="MyGoTv-hint">
			Markiere Kanäle und Turniere mit ☆ – sie erscheinen dann hier mit ihrem nächsten Termin.
		</p>
		<p class="MyGoTv-hint">
			<a class="button" href={resolve('/kanaele')}>Zu den Kanälen</a>
		</p>
	{:else}
		<ul>
			{#each items as item (item.kind + ':' + item.id)}
				<li>
					<a
						class="MyGoTv-item"
						class:MyGoTv-item-now={item.status === 'now'}
						href={item.kind === 'channel' ? resolve('/kanaele') : resolve('/kalender')}
					>
						<span class="MyGoTv-item-star" aria-hidden="true">★</span>
						<span class="MyGoTv-item-name">{item.name}</span>
						<span class="MyGoTv-item-kind">{item.kind === 'channel' ? 'Kanal' : 'Turnier'}</span>
						<span class="MyGoTv-item-when">{describe(item, date)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.MyGoTv {
		padding-bottom: 8px;
	}

	.MyGoTv-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
		padding-right: 16px;
	}

	.MyGoTv-reminder,
	.MyGoTv-reminder-note {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-left: 16px;
		font-size: 0.85em;
	}

	.MyGoTv-reminder input {
		accent-color: var(--accent);
	}

	.MyGoTv-hint {
		margin: 4px 16px 8px;
		color: var(--ink-soft);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0 16px;
	}

	li + li {
		border-top: 1px solid var(--rule);
	}

	.MyGoTv-item {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas: 'star name kind' 'star when when';
		align-items: baseline;
		gap: 0 10px;
		padding: 10px 0;
		color: var(--ink);
		text-decoration: none;
	}

	.MyGoTv-item-star {
		grid-area: star;
		color: #c8962b;
	}

	.MyGoTv-item-name {
		grid-area: name;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.MyGoTv-item-kind {
		grid-area: kind;
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	.MyGoTv-item-when {
		grid-area: when;
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.MyGoTv-item-now .MyGoTv-item-when {
		color: var(--live);
		font-weight: 600;
	}

	:global([data-design='oldschool']) .MyGoTv-header {
		background: var(--title-bar);
		color: var(--title-ink);
	}

	:global([data-design='oldschool']) .MyGoTv-item {
		padding: 4px 0;
	}
</style>
