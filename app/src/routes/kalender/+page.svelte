<script lang="ts">
	// Kalender (draft): the month as a sheet, tournaments as bars across days.
	const YEAR = 2026;
	const MONTH = 10; // November, 0-based
	const TODAY = 24;
	const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

	type Bar = { from: number; to: number; title: string; games?: boolean; starred?: boolean };
	const BARS: Array<Bar> = [
		{ from: 1, to: 1, title: 'Speed Go: Kachanovskyi gegen Campagnie', games: true },
		{ from: 8, to: 8, title: 'Speed Go: Jabarin gegen Le Calvé', games: true },
		{ from: 21, to: 22, title: 'Hungarian Open' },
		{ from: 22, to: 22, title: 'Speed Go: Surma gegen Ovsiienko', games: true },
		{ from: 28, to: 29, title: 'Berliner Kranich' },
		{ from: 29, to: 29, title: 'Speed Go: Krushelnytskyi gegen Dobranis', starred: true }
	];

	const first = new Date(YEAR, MONTH, 1);
	const offset = (first.getDay() + 6) % 7; // Monday first
	const days = new Date(YEAR, MONTH + 1, 0).getDate();
	const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
		const day = i - offset + 1;
		return day >= 1 && day <= days ? day : null;
	});

	let selected = $state(TODAY);
	let barsOf = (day: number) => BARS.filter((bar) => day >= bar.from && day <= bar.to);
</script>

<svelte:head>
	<title>Kalender – GoTV</title>
</svelte:head>

<div class="head">
	<h1>November 2026</h1>
	<div class="controls">
		<button class="button" aria-label="Voriger Monat">◀</button>
		<button class="button">Heute</button>
		<button class="button" aria-label="Nächster Monat">▶</button>
	</div>
</div>

<div class="month panel" role="grid" aria-label="November 2026">
	{#each WEEKDAYS as weekday (weekday)}
		<div class="weekday" role="columnheader">{weekday}</div>
	{/each}
	{#each cells as day, i (i)}
		{#if day}
			<button
				class="day"
				class:today={day === TODAY}
				class:selected={day === selected}
				onclick={() => (selected = day)}
				aria-label="{day}. November"
			>
				<span class="number">{day}</span>
				{#each barsOf(day) as bar (bar.title)}
					<span class="bar" class:games={bar.games} class:starred={bar.starred}>
						{#if day === bar.from || i % 7 === 0}{bar.starred
								? '★ '
								: ''}{bar.title}{:else}&nbsp;{/if}
					</span>
				{/each}
			</button>
		{:else}
			<div class="day empty"></div>
		{/if}
	{/each}
</div>

<section class="selected-day" aria-live="polite">
	<h2 class="panel-title">
		{new Date(YEAR, MONTH, selected).toLocaleDateString('de-DE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		})}
	</h2>
	{#if barsOf(selected).length}
		<ul>
			{#each barsOf(selected) as bar (bar.title)}
				<li>
					<strong>{bar.title}</strong>
					{#if bar.games}<span class="muted">Partien zum Nachspielen</span>{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">An diesem Tag ist nichts eingetragen.</p>
	{/if}
</section>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 14px;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 2.6vw, 2.2rem);
		letter-spacing: -0.015em;
	}

	.controls {
		display: flex;
		gap: 6px;
	}

	.month {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.weekday {
		padding: 8px 10px;
		color: var(--ink-soft);
		font-size: 0.85em;
		border-bottom: 1px solid var(--rule);
	}

	.day {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-height: 104px;
		padding: 6px 4px;
		border: 0;
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		background: none;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}

	.day:nth-child(7n + 7) {
		border-right: 0;
	}

	.day.empty {
		background: var(--surface-sunk);
		cursor: default;
	}

	.number {
		padding: 0 6px;
		font-variant-numeric: tabular-nums;
		color: var(--ink-soft);
	}

	.today .number {
		color: var(--accent);
		font-weight: 700;
	}

	.selected {
		background: var(--accent-soft);
	}

	.bar {
		display: block;
		padding: 2px 6px;
		border-radius: var(--radius-s);
		background: var(--surface-sunk);
		font-size: 0.8em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar.games {
		box-shadow: inset 3px 0 0 var(--ink);
	}

	.bar.starred {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.selected-day {
		margin-top: calc(var(--gap) * 1.4);
		max-width: 720px;
	}

	.selected-day .panel-title {
		padding-left: 0;
	}

	.selected-day ul {
		margin: 8px 0 0;
		padding-left: 18px;
	}

	.selected-day li {
		padding: 4px 0;
	}

	.selected-day li span {
		margin-left: 8px;
	}

	:global([data-design='oldschool']) h1 {
		font-size: 16px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .day {
		min-height: 84px;
		background: var(--surface-sunk);
		border-color: #d4d0c8;
	}

	:global([data-design='oldschool']) .weekday {
		background: var(--surface);
		color: var(--ink);
		font-weight: 700;
	}

	:global([data-design='oldschool']) .selected {
		background: var(--accent-soft);
		outline: 1px dotted #000;
		outline-offset: -3px;
	}

	:global([data-design='oldschool']) .bar {
		border-radius: 0;
		background: #fff3c4;
		border: 1px solid #c8b56d;
	}

	:global([data-design='oldschool']) .bar.starred {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .selected-day {
		background: var(--surface);
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
		padding-bottom: 6px;
	}

	:global([data-design='oldschool']) .selected-day .panel-title {
		padding-left: 6px;
	}

	@media (max-width: 640px) {
		.day {
			min-height: 64px;
		}

		.bar {
			font-size: 0;
			height: 6px;
			padding: 0;
		}
	}
</style>
