<script lang="ts">
	// "Ergebnis schätzen" (CGoban) for a watched game: the position shown,
	// with each side's area and the stones that look dead, and the result if
	// the game ended like this. Rough: random playouts, no AI (scoreEstimate).
	import { onMount, untrack } from 'svelte';
	import { locale, t } from '#lib/i18n/index.svelte.ts';
	import { estimateScore } from '#lib/model/scoreEstimate.ts';
	import type { ScoreEstimate } from '#lib/model/scoreEstimate.ts';
	import type { GameChannel } from '#lib/model/types.ts';
	import Modal from '#lib/ui/Modal.svelte';
	import Board from '#lib/ui/Board.svelte';

	let { game, onclose }: { game: GameChannel; onclose: () => void } = $props();

	let estimate = $state.raw<ScoreEstimate | null>(null);
	// The position at the moment the dialog opened - later moves do not
	// change the estimate.
	const shown = untrack(() =>
		game.tree ? (game.tree.computedState[game.tree.currentNode] ?? null) : null
	);

	onMount(() => {
		const state = shown;
		if (!state) return;
		// Let the dialog paint first; the estimate takes a moment on 19x19.
		const timer = setTimeout(() => {
			estimate = estimateScore(state.board, {
				komi: game.rules?.komi ?? 0,
				rules: game.rules?.rules,
				blackCaptures: state.blackCaptures,
				whiteCaptures: state.whiteCaptures
			});
		}, 30);
		return () => clearTimeout(timer);
	});

	function points(value: number): string {
		return value.toLocaleString(locale(), { maximumFractionDigits: 1 });
	}

	let result = $derived.by(() => {
		if (!estimate) return '';
		const margin = estimate.margin;
		if (Math.abs(margin) < 0.25) return t('game.estimate.even');
		return t('game.estimate.leads', {
			color: t(margin > 0 ? 'replay.black' : 'replay.white'),
			points: points(Math.abs(margin))
		});
	});
</script>

<Modal title={t('game.estimate.title')} {onclose} wide>
	{#if !shown}
		<p>{t('game.estimate.noBoard')}</p>
	{:else}
		<div class="ScoreEstimate">
			<div class="ScoreEstimate-board">
				<Board
					board={shown.board}
					markup={estimate?.markup ?? null}
					label={t('game.estimate.boardLabel')}
				/>
			</div>
			<div class="ScoreEstimate-text">
				{#if estimate}
					<p class="ScoreEstimate-result" role="status">{result}</p>
					<dl>
						<dt>{t('replay.black')}</dt>
						<dd>{t('game.estimate.points', { points: points(estimate.blackScore) })}</dd>
						<dt>{t('replay.white')}</dt>
						<dd>
							{t('game.estimate.pointsKomi', {
								points: points(estimate.whiteScore),
								komi: points(game.rules?.komi ?? 0)
							})}
						</dd>
					</dl>
				{:else}
					<p role="status">{t('game.estimate.working')}</p>
				{/if}
				<p class="ScoreEstimate-note">{t('game.estimate.note')}</p>
			</div>
		</div>
	{/if}
</Modal>

<style>
	.ScoreEstimate {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-start;
	}

	.ScoreEstimate-board {
		width: min(480px, 80vw);
		aspect-ratio: 1;
	}

	.ScoreEstimate-text {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 32ch;
	}

	.ScoreEstimate-text p {
		margin: 0;
	}

	.ScoreEstimate-result {
		font-size: 1.15rem;
		font-weight: 700;
	}

	.ScoreEstimate-text dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 2px 12px;
		margin: 0;
	}

	.ScoreEstimate-text dd {
		margin: 0;
	}

	.ScoreEstimate-note {
		color: var(--ink-soft);
		font-size: 0.93em;
	}
</style>
