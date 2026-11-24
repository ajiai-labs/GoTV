<script lang="ts">
	// "Zuletzt nachgespielt": reopen a game where it was left (this browser).
	import { getRecentReplays } from '#lib/model/ReplayProgress.ts';

	let {
		onOpenReplay,
		refreshKey
	}: {
		onOpenReplay: (url: string) => unknown;
		// Changes whenever a game was opened, so the list re-reads storage.
		refreshKey?: unknown;
	} = $props();

	const MAX_SHOWN = 5;
	const uid = $props.id();

	let recent = $derived.by(() => {
		void refreshKey;
		return getRecentReplays(MAX_SHOWN);
	});
</script>

{#if recent.length}
	<section class="recent panel" aria-labelledby="{uid}-title">
		<h2 id="{uid}-title" class="panel-title">Zuletzt nachgespielt</h2>
		<ul>
			{#each recent as entry (entry.key)}
				<li>
					<button
						type="button"
						class="item"
						onclick={() => {
							if (entry.url) onOpenReplay(entry.url);
						}}
					>
						<span class="name">{entry.title}</span>
						<span class="move muted">
							weiter bei Zug {entry.move}{entry.bookmarks.length
								? ' · ' + String(entry.bookmarks.length) + ' Lesezeichen'
								: ''}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	ul {
		margin: 0;
		padding: 4px 0 6px;
		list-style: none;
	}

	li + li {
		border-top: 1px solid var(--rule);
	}

	.item {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 12px;
		width: 100%;
		padding: 10px 16px;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.item:hover,
	.item:focus-visible {
		background: var(--surface-sunk);
	}

	.name {
		font-weight: 600;
	}

	.move {
		font-size: 0.9em;
	}

	:global([data-design='oldschool']) .item {
		padding: 4px 6px;
	}

	:global([data-design='oldschool']) .item:hover,
	:global([data-design='oldschool']) .item:focus-visible {
		background: var(--accent);
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .item:hover .move,
	:global([data-design='oldschool']) .item:focus-visible .move {
		color: var(--accent-ink);
	}
</style>
