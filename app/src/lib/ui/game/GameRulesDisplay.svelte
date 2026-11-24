<script lang="ts">
	// The rules of a game in one line: time system, board size if not 19×19,
	// handicap and komi. The parts keep the old class names, so a list can
	// hide one of them (:global(.GameRulesDisplay-komi)).
	import type { GameRules } from '#lib/model/types.ts';
	import GameTimeSystem from './GameTimeSystem.svelte';

	let { rules }: { rules: GameRules } = $props();
</script>

<div class="GameRulesDisplay">
	{#if rules.timeSystem}
		<div class="GameRulesDisplay-time">
			<GameTimeSystem {rules} />
		</div>
	{/if}
	{#if (rules.size && rules.size !== 19) || rules.handicap}
		<div class="GameRulesDisplay-size">
			{rules.size !== 19 ? `${rules.size}×${rules.size}` : ''}{rules.handicap
				? ' H' + rules.handicap
				: ''}
		</div>
	{/if}
	{#if rules.komi}
		<div class="GameRulesDisplay-komi">Komi {rules.komi}</div>
	{/if}
</div>

<style>
	.GameRulesDisplay {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
	}
</style>
