<script lang="ts">
	// Kanäle (draft): the week with fixed air times, then the channels.
	import { channels } from '#lib/demo/index.ts';

	const WEEK = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	const TODAY = 1; // Tuesday, 24 November 2026 (0 = Monday)
	const plan: Record<number, Array<string>> = { 6: ['10:30 JuppTube'] };

	let groups = $derived([
		{ name: 'Spieler', list: channels.filter((c) => c.player) },
		{ name: 'Verbände und Turniere', list: channels.filter((c) => !c.player) }
	]);
</script>

<svelte:head>
	<title>Kanäle – GoTV</title>
</svelte:head>

<h1>Kanäle</h1>

<ol class="week panel" aria-label="Feste Sendezeiten dieser Woche">
	{#each WEEK as day, i (day)}
		<li class:today={i === TODAY}>
			<span class="weekday">{day}</span>
			{#each plan[i] ?? [] as entry (entry)}
				<span class="slot">{entry}</span>
			{/each}
		</li>
	{/each}
</ol>

{#each groups as group (group.name)}
	<section aria-labelledby="group-{group.name}">
		<h2 id="group-{group.name}" class="panel-title">{group.name}</h2>
		<ul>
			{#each group.list as channel (channel.id)}
				<li>
					<button
						class="star"
						class:on={channel.starred}
						aria-pressed={channel.starred}
						aria-label="{channel.name} merken"
					>
						{channel.starred ? '★' : '☆'}
					</button>
					<div class="who">
						<strong>{channel.name}</strong>
						{#if channel.who}<span class="muted">{channel.who}</span>{/if}
					</div>
					<span class="when">{channel.schedule ?? 'ohne feste Zeit'}</span>
					<span class="platform">{channel.platform}</span>
					<button class="button">Stream laden</button>
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	h1 {
		margin: 8px 0 16px;
		font-size: clamp(1.5rem, 2.6vw, 2.2rem);
		letter-spacing: -0.015em;
	}

	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		list-style: none;
		margin: 0 0 calc(var(--gap) * 1.4);
		padding: 0;
	}

	.week li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 76px;
		padding: 10px;
		border-right: 1px solid var(--rule);
	}

	.week li:last-child {
		border-right: 0;
	}

	.week .today {
		background: var(--accent-soft);
	}

	.weekday {
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	.slot {
		font-weight: 600;
		font-size: 0.9em;
	}

	section {
		max-width: 920px;
		margin-bottom: var(--gap);
	}

	section .panel-title {
		padding-left: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	ul li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 14px;
		padding: 10px 0;
		border-bottom: 1px solid var(--rule);
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.when,
	.platform {
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.star {
		border: 0;
		background: none;
		font-size: 1.3rem;
		color: var(--ink-soft);
		cursor: pointer;
		padding: 4px;
	}

	.star.on {
		color: #c8962b;
	}

	:global([data-design='oldschool']) h1 {
		font-size: 16px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .week li {
		background: var(--surface-sunk);
		border-color: #d4d0c8;
		min-height: 60px;
	}

	:global([data-design='oldschool']) .week .today {
		background: var(--accent-soft);
	}

	:global([data-design='oldschool']) section {
		background: var(--surface);
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) section .panel-title {
		padding-left: 6px;
	}

	:global([data-design='oldschool']) ul li {
		padding: 3px 6px;
		gap: 10px;
		background: var(--surface-sunk);
		border-bottom-color: #d4d0c8;
	}

	@media (max-width: 640px) {
		ul li {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.when,
		.platform {
			display: none;
		}

		.week li {
			padding: 6px 4px;
			min-height: 56px;
		}
	}
</style>
