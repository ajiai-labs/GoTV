<script module lang="ts">
	import { getLiveWindow, hasOgsReplay, REPLAY_KEEP_DAYS, REPLAY_KEEP_MS } from '#lib/model/tv.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { formatEventDateRange } from './eventDate.ts';

	// How long a finished tournament is offered under Live.
	export const JUST_ENDED_MS = 24 * 60 * 60 * 1000;

	// Tournaments that ended less than maxAgeMs ago (or are running) whose
	// games can be replayed (OGS games or a recorded SGF), newest first.
	export function getRecentReplayEvents(
		events: Array<TvEvent>,
		now: number,
		maxAgeMs: number = REPLAY_KEEP_MS
	): Array<TvEvent> {
		return events
			.filter((event) => {
				const window = getLiveWindow(event);
				return (
					(hasOgsReplay(event) || !!event.sgf_url) &&
					window.start.getTime() <= now &&
					now - window.end.getTime() < maxAgeMs
				);
			})
			.sort((a, b) => getLiveWindow(b).start.getTime() - getLiveWindow(a).start.getTime());
	}
</script>

<script lang="ts">
	// Tournament games to replay: under Nachspielen the last three months,
	// under Live (justEnded) those of the last 24 hours, games listed at once.
	import ReplayGameList from './ReplayGameList.svelte';

	let {
		events,
		now,
		onOpenReplay,
		justEnded = false
	}: {
		events: Array<TvEvent>;
		now: number;
		onOpenReplay: (url: string) => unknown;
		// "Gerade zu Ende" under Live: only events that ended this recently,
		// their games listed right away, nothing rendered when there are none.
		justEnded?: boolean;
	} = $props();

	const uid = $props.id();

	let recent = $derived(
		justEnded
			? getRecentReplayEvents(events, now, JUST_ENDED_MS).filter(
					(event) => getLiveWindow(event).end.getTime() < now
				)
			: getRecentReplayEvents(events, now)
	);
</script>

{#if !justEnded || recent.length}
	<section class="replays panel" class:just-ended={justEnded} aria-labelledby="{uid}-title">
		<h2 id="{uid}-title" class="panel-title">
			{justEnded
				? 'Gerade zu Ende – Partien nachspielen'
				: 'Turnierpartien der letzten ' + String(Math.round(REPLAY_KEEP_DAYS / 30)) + ' Monate'}
		</h2>
		{#if recent.length}
			<ul>
				{#each recent as event (event.id)}
					<li>
						<div class="name">{event.name}</div>
						<div class="date muted">{formatEventDateRange(event)}</div>
						{#if hasOgsReplay(event)}
							<ReplayGameList {event} {onOpenReplay} defaultOpen={justEnded} />
						{:else}
							<button
								type="button"
								class="small-button"
								onclick={() => {
									if (event.sgf_url) onOpenReplay(event.sgf_url);
								}}
							>
								SGF nachspielen
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty muted">Keine Turnierpartien aus den letzten Monaten.</p>
		{/if}
	</section>
{/if}

<style>
	ul {
		margin: 0;
		padding: 4px 16px 8px;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 10px 0 12px;
	}

	li + li {
		border-top: 1px solid var(--rule);
	}

	.name {
		font-weight: 650;
	}

	.date {
		font-size: 0.9em;
	}

	.empty {
		margin: 0;
		padding: 8px 16px 16px;
	}

	.just-ended {
		border-color: var(--accent);
	}

	.small-button {
		display: inline-flex;
		align-items: center;
		padding: 5px 12px;
		border: var(--button-border);
		border-radius: var(--radius-pill);
		background: var(--button-bg);
		color: var(--ink);
		font-size: 0.92em;
		cursor: pointer;
	}

	:global([data-design='oldschool']) ul {
		padding: 2px 6px 4px;
	}

	:global([data-design='oldschool']) li {
		padding: 4px 0 6px;
	}

	:global([data-design='oldschool']) .empty {
		padding: 6px;
	}

	:global([data-design='oldschool']) .small-button {
		padding: 2px 8px;
	}
</style>
