<script lang="ts">
	// The channels' fixed air times as a week (German time), today marked.
	// Shown only when at least one channel has a schedule.
	import { getGermanClock, getWeekPlan, isChannelOnAir } from '#lib/model/tvChannels.ts';
	import type { TvChannel } from '#lib/model/tv.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/index.svelte.ts';

	let {
		channels,
		now,
		favoriteIds = []
	}: {
		channels: Array<TvChannel>;
		now: number;
		favoriteIds?: Array<string>;
	} = $props();

	const DAY_NAMES: Array<MessageKey> = [
		'tv.weekday.1',
		'tv.weekday.2',
		'tv.weekday.3',
		'tv.weekday.4',
		'tv.weekday.5',
		'tv.weekday.6',
		'tv.weekday.7'
	];

	let week = $derived(getWeekPlan(channels));
	let hasEntries = $derived(week.some((day) => day.entries.length));
	let today = $derived(getGermanClock(new Date(now)).weekday);
</script>

{#if hasEntries}
	<section class="ChannelWeek panel" aria-labelledby="ChannelWeek-title">
		<h2 class="ChannelWeek-title panel-title" id="ChannelWeek-title">
			{t('tv.week.title')}
		</h2>
		<ol class="ChannelWeek-days">
			{#each week as day (day.weekday)}
				{@const isToday = day.weekday === today}
				<li
					class="ChannelWeek-day"
					class:ChannelWeek-day-today={isToday}
					aria-label={isToday
						? t('tv.week.today', { day: t(DAY_NAMES[day.weekday - 1]) })
						: t(DAY_NAMES[day.weekday - 1])}
				>
					<span class="ChannelWeek-day-label">{day.label}</span>
					{#each day.entries as entry (entry.channel.id + entry.time)}
						{@const running = isToday && isChannelOnAir(entry.channel, new Date(now))}
						<span class="ChannelWeek-entry" class:ChannelWeek-entry-now={running}>
							<span class="ChannelWeek-entry-time">{entry.time}</span>
							{favoriteIds.includes(entry.channel.id) ? '★ ' : ''}{entry.channel.name}
							{#if running}<span class="visually-hidden">{t('tv.week.running')}</span>{/if}
						</span>
					{:else}
						<span class="ChannelWeek-empty">–</span>
					{/each}
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.ChannelWeek {
		margin-bottom: calc(var(--gap) * 1.2);
	}

	.ChannelWeek-title {
		padding-bottom: 10px;
		font-size: 0.95rem;
	}

	.ChannelWeek-days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--rule);
	}

	.ChannelWeek-day {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		min-height: 76px;
		padding: 10px;
		border-right: 1px solid var(--rule);
	}

	.ChannelWeek-day:last-child {
		border-right: 0;
	}

	.ChannelWeek-day-today {
		background: var(--accent-soft);
	}

	.ChannelWeek-day-label {
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	.ChannelWeek-day-today .ChannelWeek-day-label {
		color: var(--accent);
		font-weight: 700;
	}

	.ChannelWeek-entry {
		font-size: 0.9em;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.ChannelWeek-entry-time {
		font-variant-numeric: tabular-nums;
	}

	.ChannelWeek-entry-now {
		color: #c4302b;
		font-weight: 700;
	}

	.ChannelWeek-entry-now::before {
		content: '● ';
	}

	.ChannelWeek-empty {
		color: var(--ink-soft);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	:global([data-design='oldschool']) .ChannelWeek-title {
		padding-bottom: 3px;
		font-size: var(--title-size);
	}

	:global([data-design='oldschool']) .ChannelWeek-day {
		min-height: 60px;
		padding: 4px 6px;
		background: var(--surface-sunk);
		border-color: #d4d0c8;
	}

	:global([data-design='oldschool']) .ChannelWeek-day-today {
		background: var(--accent-soft);
	}

	:global([data-design='oldschool']) .ChannelWeek-day-today .ChannelWeek-day-label {
		color: var(--ink);
	}

	:global([data-design='oldschool']) .ChannelWeek-entry-now {
		color: var(--live);
	}

	@media (max-width: 600px) {
		.ChannelWeek-days {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.ChannelWeek-day {
			min-height: 56px;
			padding: 6px 8px;
			border-bottom: 1px solid var(--rule);
		}

		.ChannelWeek-day:nth-child(2n) {
			border-right: 0;
		}
	}
</style>
