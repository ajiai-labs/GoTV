<script lang="ts">
	// The rules of a game in one line: time system, board size if not 19×19,
	// handicap and komi. The parts keep the old class names, so a list can
	// hide one of them (:global(.GameRulesDisplay-komi)). `full` (game lists
	// on Beobachten, user wish 28.11.2026): always the board size, also
	// 19×19, size first, then the time and the rule set.
	import type { GameRules } from '#lib/model/types.ts';
	import GameTimeSystem from './GameTimeSystem.svelte';
	import { formatRulesetDe } from './gameText.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { rules, full = false }: { rules: GameRules; full?: boolean } = $props();

	let size = $derived(
		rules.size && (full || rules.size !== 19) ? `${rules.size}×${rules.size}` : ''
	);
	let handicap = $derived(rules.handicap ? `H${rules.handicap}` : '');
</script>

<div class="GameRulesDisplay" class:GameRulesDisplay-full={full}>
	{#if full && size}
		<div class="GameRulesDisplay-size">{[size, handicap].filter(Boolean).join(' ')}</div>
	{/if}
	{#if rules.timeSystem}
		<div class="GameRulesDisplay-time">
			<GameTimeSystem {rules} />
		</div>
	{/if}
	{#if full && rules.rules}
		<div class="GameRulesDisplay-ruleset">{formatRulesetDe(rules.rules)}</div>
	{/if}
	{#if !full && (size || handicap)}
		<div class="GameRulesDisplay-size">{[size, handicap].filter(Boolean).join(' ')}</div>
	{/if}
	{#if typeof rules.komi === 'number' && (rules.komi || full)}
		<div class="GameRulesDisplay-komi">{t('game.rules.komi', { komi: rules.komi })}</div>
	{/if}
</div>

<style>
	.GameRulesDisplay {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
	}

	.GameRulesDisplay-full .GameRulesDisplay-size {
		font-weight: 600;
		color: var(--ink);
	}
</style>
