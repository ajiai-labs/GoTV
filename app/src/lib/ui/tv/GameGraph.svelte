<script lang="ts">
	// The whole game at a glance: black's chance to win after every move
	// (top = black wins), the current move marked, mistakes as red marks.
	// A click on the curve jumps to that move; with the curve focused, the
	// arrow keys step through the game (like WinCurve).
	import { formatPoint } from '#lib/model/KataGoEngine.ts';
	import type { GameMistake, PositionEval } from '#lib/model/KataGoEngine.ts';
	import type { GameTree } from '#lib/model/types.ts';

	let {
		tree,
		evals,
		mistakes,
		currentMove,
		onJump
	}: {
		tree: GameTree;
		evals: Array<PositionEval>;
		mistakes: Array<GameMistake>;
		currentMove: number;
		onJump: (nodeId: number) => unknown;
	} = $props();

	const WIDTH = 600;
	const HEIGHT = 90;
	const COLOR_LABEL = { black: 'Schwarz', white: 'Weiß' } as const;

	function formatPoints(value: number): string {
		return value.toLocaleString('de-DE', {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		});
	}

	function x(move: number): number {
		const last = Math.max(1, evals.length - 1);
		return (move / last) * WIDTH;
	}

	function y(winRate: number): number {
		return (1 - Math.max(0, Math.min(1, winRate))) * HEIGHT;
	}

	let points = $derived(
		evals
			.filter((value) => isFinite(value.winRate))
			.map((value) => x(value.move) + ',' + y(value.winRate))
			.join(' ')
	);
	let size = $derived(tree.computedState[tree.rootNode]?.board.length ?? 19);
	let currentValue = $derived(evals[currentMove]?.winRate);

	function jumpToMove(move: number) {
		if (!evals.length) return;
		const target = evals[Math.max(0, Math.min(evals.length - 1, move))];
		onJump(target.nodeId);
	}

	function onClickGraph(event: MouseEvent) {
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const share = box.width ? (event.clientX - box.left) / box.width : 0;
		jumpToMove(Math.round(share * (evals.length - 1)));
	}

	function onKey(event: KeyboardEvent) {
		const steps: Record<string, number> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			PageDown: -10,
			PageUp: 10
		};
		let next: number | null = null;
		if (event.key in steps) next = currentMove + steps[event.key];
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = evals.length - 1;
		if (next === null) return;
		event.preventDefault();
		jumpToMove(next);
	}

	function mistakePoint(mistake: GameMistake): string {
		const move = tree.nodes[mistake.nodeId]?.props.find((prop) => prop.name === 'MOVE');
		const loc = move?.loc;
		return loc && loc !== 'PASS' ? formatPoint(loc.x, loc.y, size) : 'Passen';
	}
</script>

<div class="graph">
	<svg
		class="curve"
		viewBox="0 0 {WIDTH} {HEIGHT}"
		preserveAspectRatio="none"
		role="slider"
		tabindex="0"
		aria-label="Gewinnchance Schwarz über die ganze Partie"
		aria-valuemin={0}
		aria-valuemax={Math.max(0, evals.length - 1)}
		aria-valuenow={currentMove}
		aria-valuetext={typeof currentValue === 'number' && isFinite(currentValue)
			? `Zug ${currentMove}, Schwarz ${Math.round(currentValue * 100)} Prozent`
			: `Zug ${currentMove}`}
		onclick={onClickGraph}
		onkeydown={onKey}
	>
		<rect width={WIDTH} height={HEIGHT / 2} class="half-black" />
		<rect y={HEIGHT / 2} width={WIDTH} height={HEIGHT / 2} class="half-white" />
		<line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} class="middle" />
		<polyline {points} class="line" />
		{#each mistakes as mistake (mistake.move)}
			{@const value = evals[mistake.move]}
			{#if value}
				<line
					x1={x(mistake.move)}
					x2={x(mistake.move)}
					y1={Math.max(0, y(value.winRate) - 10)}
					y2={Math.min(HEIGHT, y(value.winRate) + 10)}
					class="mistake"
				/>
			{/if}
		{/each}
		<line x1={x(currentMove)} x2={x(currentMove)} y1="0" y2={HEIGHT} class="current" />
	</svg>
	<p class="legend muted">
		oben Schwarz vorn, unten Weiß · Klick auf die Kurve springt zum Zug · Fehler nach verlorener
		Gewinnchance, Punkte mit KataGo-Suche geprüft; das mitgelieferte kleine Netz ist in Ko-Kämpfen
		ungenau
	</p>
	<div class="mistakes">
		{#if mistakes.length}
			<span class="mistakes-title">Partieentscheidende Fehler:</span>
			{#each mistakes as mistake (mistake.move)}
				<button
					type="button"
					class="mistake-button"
					title="Stellung vor dem Zug zeigen – KataGo zeigt dort den besseren Zug"
					onclick={() => onJump(mistake.beforeNodeId)}
				>
					Zug {mistake.move} · {COLOR_LABEL[mistake.color]}
					{mistakePoint(mistake)}: −{Math.round(mistake.winRateLost * 100)} % · −{formatPoints(
						mistake.pointsLost
					)} Punkte
				</button>
			{/each}
		{:else}
			<span>Keine Züge, die 2 Punkte oder mehr verloren haben.</span>
		{/if}
	</div>
</div>

<style>
	.graph {
		margin: 8px 0;
	}

	.curve {
		display: block;
		width: 100%;
		height: 90px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		cursor: crosshair;
		touch-action: manipulation;
	}

	.half-black {
		fill: var(--surface-sunk);
	}

	.half-white {
		fill: var(--surface);
	}

	.middle {
		stroke: var(--rule);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.line {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	.mistake {
		stroke: #c4302b;
		stroke-width: 3;
		vector-effect: non-scaling-stroke;
	}

	.current {
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	.legend {
		margin: 4px 0 0;
		font-size: 0.8em;
	}

	.mistakes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
	}

	.mistakes-title {
		font-weight: 650;
	}

	.mistake-button {
		padding: 4px 10px;
		border: 1px solid #c4302b;
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: #8a1f1b;
		cursor: pointer;
		text-align: left;
	}

	:global([data-design='oldschool']) .curve {
		border: 2px inset #ece9e2;
		border-radius: 0;
	}

	:global([data-design='oldschool']) .half-white {
		fill: #ffffff;
	}

	:global([data-design='oldschool']) .mistakes-title {
		font-weight: 700;
	}
</style>
