<script lang="ts">
	// The Go board of GoTV, drawn as SVG so it is sharp at any size (phone,
	// iPad, desktop). Its look follows the chosen design: flat and calm in
	// "modern", wood grain and shaded stones in "oldschool".
	import type { BoardState, Point } from '#lib/model/types.ts';
	import { design } from './design.svelte';

	type Label = { x: number; y: number; text: string };

	let {
		board,
		lastMove = null,
		labels = [],
		coordinates = true,
		label = 'Go-Brett',
		onpoint
	}: {
		board: BoardState;
		lastMove?: Point | null;
		labels?: Array<Label>;
		coordinates?: boolean;
		label?: string;
		onpoint?: (point: Point) => void;
	} = $props();

	const uid = $props.id();
	const COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
	const STAR_POINTS: Record<number, Array<number>> = {
		19: [3, 9, 15],
		13: [3, 6, 9],
		9: [2, 4, 6]
	};

	let size = $derived(board.length);
	let margin = $derived(coordinates ? 1.15 : 0.62);
	let view = $derived(`${-margin} ${-margin} ${size - 1 + 2 * margin} ${size - 1 + 2 * margin}`);
	// Star points: every crossing of the star lines; on 9x9 only the four
	// corners and the centre.
	let stars = $derived.by(() => {
		let lines = STAR_POINTS[size] ?? [];
		let points = lines.flatMap((y) => lines.map((x) => ({ x, y })));
		return size === 9 ? points.filter((p) => (p.x === 4) === (p.y === 4)) : points;
	});
	let stones = $derived.by(() => {
		let list: Array<{ x: number; y: number; color: 'black' | 'white' }> = [];
		board.forEach((row, y) =>
			row.forEach((color, x) => {
				if (color) {
					list.push({ x, y, color });
				}
			})
		);
		return list;
	});
	let oldschool = $derived(design.current === 'oldschool');
	let lastColor = $derived(lastMove ? board[lastMove.y]?.[lastMove.x] : null);
</script>

<svg class="board" class:oldschool viewBox={view} role="img" aria-label={label}>
	<defs>
		<radialGradient id="{uid}-black" cx="0.36" cy="0.32" r="0.75">
			<stop offset="0" stop-color={oldschool ? '#6e6e6e' : '#3d4642'} />
			<stop offset="0.45" stop-color={oldschool ? '#1a1a1a' : '#1f2523'} />
			<stop offset="1" stop-color="#0a0c0b" />
		</radialGradient>
		<radialGradient id="{uid}-white" cx="0.36" cy="0.32" r="0.8">
			<stop offset="0" stop-color="#ffffff" />
			<stop offset="0.7" stop-color={oldschool ? '#ece7da' : '#f1f3ef'} />
			<stop offset="1" stop-color={oldschool ? '#bdb6a3' : '#d7ddd6'} />
		</radialGradient>
		<filter id="{uid}-shadow" x="-30%" y="-30%" width="160%" height="160%">
			<feDropShadow
				dx={oldschool ? 0.07 : 0.03}
				dy={oldschool ? 0.09 : 0.05}
				stdDeviation={oldschool ? 0.05 : 0.06}
				flood-color="#000"
				flood-opacity={oldschool ? 0.55 : 0.28}
			/>
		</filter>
		<filter id="{uid}-wood" x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency="0.035 0.6" numOctaves="3" seed="7" />
			<feColorMatrix
				type="matrix"
				values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.06  0 0 0 1.5 -0.62"
			/>
		</filter>
	</defs>

	<rect
		class="wood"
		x={-margin}
		y={-margin}
		width={size - 1 + 2 * margin}
		height={size - 1 + 2 * margin}
		rx={oldschool ? 0 : 0.18}
	/>
	{#if oldschool}
		<rect
			x={-margin}
			y={-margin}
			width={size - 1 + 2 * margin}
			height={size - 1 + 2 * margin}
			filter="url(#{uid}-wood)"
		/>
	{/if}

	<g class="grid">
		{#each { length: size }, i (i)}
			<line x1="0" y1={i} x2={size - 1} y2={i} />
			<line x1={i} y1="0" x2={i} y2={size - 1} />
		{/each}
		<rect class="edge" x="0" y="0" width={size - 1} height={size - 1} />
	</g>

	{#each stars as star (star.x + '-' + star.y)}
		<circle class="star" cx={star.x} cy={star.y} r={oldschool ? 0.1 : 0.085} />
	{/each}

	{#if coordinates}
		<g class="coords">
			{#each { length: size }, i (i)}
				<text x={i} y={-margin + 0.5}>{COLUMNS[i]}</text>
				<text x={i} y={size - 1 + margin - 0.38}>{COLUMNS[i]}</text>
				<text x={-margin + 0.45} y={i + 0.13}>{size - i}</text>
				<text x={size - 1 + margin - 0.45} y={i + 0.13}>{size - i}</text>
			{/each}
		</g>
	{/if}

	<g filter="url(#{uid}-shadow)">
		{#each stones as stone (stone.x + '-' + stone.y)}
			<circle
				class="stone {stone.color}"
				cx={stone.x}
				cy={stone.y}
				r="0.475"
				fill="url(#{uid}-{stone.color})"
			/>
		{/each}
	</g>

	{#if lastMove && lastColor}
		<circle class="last {lastColor}" cx={lastMove.x} cy={lastMove.y} r={oldschool ? 0.2 : 0.24} />
	{/if}

	{#each labels as item (item.x + '-' + item.y)}
		<g class="label">
			<circle cx={item.x} cy={item.y} r="0.36" />
			<text x={item.x} y={item.y + 0.17}>{item.text}</text>
		</g>
	{/each}

	{#if onpoint}
		{#each { length: size * size }, i (i)}
			<rect
				class="hit"
				x={(i % size) - 0.5}
				y={Math.floor(i / size) - 0.5}
				width="1"
				height="1"
				role="presentation"
				onclick={() => onpoint({ x: i % size, y: Math.floor(i / size) })}
			/>
		{/each}
	{/if}
</svg>

<style>
	.board {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		user-select: none;
		-webkit-user-select: none;
	}

	.wood {
		fill: var(--board);
		stroke: var(--board-edge);
		stroke-width: 0.06;
	}

	.grid line,
	.grid .edge {
		stroke: var(--board-line);
		stroke-width: 0.035;
		fill: none;
		vector-effect: non-scaling-stroke;
	}

	.grid line {
		stroke-width: 1px;
		opacity: 0.85;
	}

	.grid .edge {
		stroke-width: 1.6px;
	}

	.star {
		fill: var(--board-line);
	}

	.coords text {
		fill: var(--board-coord);
		font-family: var(--font-ui);
		font-size: 0.42px;
		text-anchor: middle;
	}

	.oldschool .coords text {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 0.45px;
	}

	.stone.white {
		stroke: rgba(0, 0, 0, 0.18);
		stroke-width: 0.02;
	}

	.last {
		fill: none;
		stroke: var(--accent);
		stroke-width: 0.07;
	}

	.last.black {
		stroke: #7fd3b2;
	}

	.oldschool .last.black {
		stroke: #ffffff;
		stroke-width: 0.06;
	}

	.oldschool .last.white {
		stroke: #000000;
		stroke-width: 0.06;
	}

	.label circle {
		fill: var(--accent);
	}

	.label text {
		fill: var(--accent-ink);
		font-family: var(--font-ui);
		font-size: 0.42px;
		font-weight: 700;
		text-anchor: middle;
	}

	.oldschool .label circle {
		fill: var(--board);
		stroke: var(--accent);
		stroke-width: 0.05;
	}

	.oldschool .label text {
		fill: var(--accent);
	}

	.hit {
		fill: transparent;
		cursor: pointer;
	}
</style>
