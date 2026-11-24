<script lang="ts" module>
	import { formatGameTimeSystem } from '#lib/model/game/display.ts';
	import type { GameRules } from '#lib/model/types.ts';

	// formatGameTimeSystem (taken over unchanged) speaks English in two
	// places; the new interface shows German.
	export function formatTimeSystemDe(rules: GameRules): string {
		const text = formatGameTimeSystem(rules) ?? '';
		if (rules.timeSystem === 'none') return 'Ohne Zeitlimit';
		return text.replace(/ absolute$/, ' absolut');
	}
</script>

<script lang="ts">
	// The time system of a game ("10:00 + 5×0:30") with a sign for its pace:
	// two bolts for very fast, one for fast, an hourglass for slow games.
	import { getGameTimeSpeed } from '#lib/model/game/display.ts';

	let { rules }: { rules: GameRules } = $props();

	let speed = $derived(getGameTimeSpeed(rules));
	let icon = $derived(
		speed === 'very fast' ? '⚡⚡' : speed === 'fast' ? '⚡' : speed === 'slow' ? '⏳' : ''
	);
	let speedLabel = $derived(
		speed === 'very fast' ? 'sehr schnell' : speed === 'fast' ? 'schnell' : 'langsam'
	);
</script>

<span class="GameTimeSystem">
	{#if icon}
		<span class="GameTimeSystem-icon" role="img" aria-label={speedLabel} title={speedLabel}>
			{icon}
		</span>
	{/if}
	{formatTimeSystemDe(rules)}
</span>

<style>
	.GameTimeSystem {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.GameTimeSystem-icon {
		font-size: 0.85em;
		letter-spacing: -2px;
	}
</style>
