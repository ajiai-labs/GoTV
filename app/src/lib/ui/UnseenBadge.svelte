<script lang="ts">
	// Count of unseen messages or proposals. "major" (direct messages,
	// proposals) is drawn strong, "minor" (room chat) quiet.
	let { major = 0, minor = 0 }: { major?: number; minor?: number } = $props();
</script>

{#if major || minor}
	<span class="badge" class:major={!!major} aria-label="{major || minor} neu">
		{major || minor}
	</span>
{/if}

<style>
	.badge {
		display: inline-grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: var(--radius-pill);
		background: var(--surface-sunk);
		color: var(--ink-soft);
		font-size: 11px;
		font-weight: 700;
		line-height: 1;
	}

	.major {
		background: var(--live);
		color: #fff;
	}
</style>
