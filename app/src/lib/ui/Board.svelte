<script lang="ts">
	// The Go board of GoTV, drawn as SVG so it is sharp at any size (phone,
	// iPad, desktop). Its look follows the chosen design: flat and calm in
	// "modern", wood grain and shaded stones in "oldschool".
	//
	// Stones: white like clam shell, black like slate (board/stoneLook.ts).
	//
	// Everything the old board showed is here: the last move ("active"), a
	// move waiting for the server (pendingBlack/White), territory, dead
	// stones, triangle/square/circle/cross, letters. With `ghost` set, a
	// see-through stone follows the pointer (playing).
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { BoardMarkup, BoardPointMark, BoardState, Point } from '#lib/model/types.ts';
	import { design } from './design.svelte.ts';
	import {
		SHELL_VARIANTS,
		STONE_RADIUS,
		WHITE_RADIUS,
		shellLines,
		shellVariant
	} from './board/stoneLook.ts';

	type Label = { x: number; y: number; text: string };

	let {
		board,
		markup = null,
		lastMove = null,
		labels = [],
		coordinates = true,
		label,
		ghost = null,
		territoryStones = false,
		onpoint
	}: {
		board: BoardState;
		markup?: BoardMarkup | null;
		lastMove?: Point | null;
		labels?: Array<Label>;
		coordinates?: boolean;
		label?: string;
		ghost?: 'black' | 'white' | null;
		// Territory as small stones, dead stones with the owner's small stone
		// on them (as CGoban's "Geschätztes Ergebnis").
		territoryStones?: boolean;
		onpoint?: (point: Point, color: 'black' | 'white' | null, mark: BoardPointMark | null) => void;
	} = $props();

	const uid = $props.id();
	const COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
	const STAR_POINTS: Record<number, Array<number>> = {
		19: [3, 9, 15],
		13: [3, 6, 9],
		9: [2, 4, 6]
	};
	const SHELLS = Array.from({ length: SHELL_VARIANTS }, (_, v) => shellLines(v));
	const radius = (color: 'black' | 'white') => (color === 'white' ? WHITE_RADIUS : STONE_RADIUS);
	const TERRITORY_STONE_RADIUS = 0.24;
	const SHAPES = new Set<BoardPointMark>(['triangle', 'square', 'circle', 'cross']);

	type Mark = { x: number; y: number; mark: BoardPointMark };

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
	let marks = $derived.by(() => {
		let list: Array<Mark> = [];
		for (const [y, row] of Object.entries(markup?.marks ?? {})) {
			for (const [x, mark] of Object.entries(row)) {
				if (mark) list.push({ x: Number(x), y: Number(y), mark });
			}
		}
		return list;
	});
	let markAt = (x: number, y: number) => markup?.marks[y]?.[x] ?? null;
	let stones = $derived.by(() => {
		let list: Array<{ x: number; y: number; color: 'black' | 'white'; dead: boolean }> = [];
		board.forEach((row, y) =>
			row.forEach((color, x) => {
				if (color) list.push({ x, y, color, dead: markAt(x, y) === 'dead' });
			})
		);
		return list;
	});
	let texts = $derived.by(() => {
		let list: Array<Label> = [];
		for (const [y, row] of Object.entries(markup?.labels ?? {})) {
			for (const [x, text] of Object.entries(row)) {
				if (text) list.push({ x: Number(x), y: Number(y), text });
			}
		}
		return list;
	});
	// The last move: given directly, or the "active" mark of the markup.
	let last = $derived(lastMove ?? marks.find((m) => m.mark === 'active') ?? null);
	let oldschool = $derived(design.current === 'oldschool');
	let colorAt = (x: number, y: number) => board[y]?.[x] ?? null;
	// Marks on a black stone are drawn light, everywhere else dark.
	let ink = (x: number, y: number) => (colorAt(x, y) === 'black' ? '#ffffff' : '#1d2421');

	let hover = $state<Point | null>(null);
	let showGhost = $derived(
		!!ghost && !!hover && !colorAt(hover.x, hover.y) && !markAt(hover.x, hover.y)
	);

	function pointFrom(event: PointerEvent): Point | null {
		const svg = event.currentTarget as SVGSVGElement;
		const matrix = svg.getScreenCTM();
		if (!matrix) return null;
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		const x = Math.round(p.x);
		const y = Math.round(p.y);
		return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
	}
</script>

<svg
	class="board"
	class:oldschool
	class:clickable={!!onpoint}
	viewBox={view}
	role="img"
	aria-label={label ?? t('app.board.label')}
	onpointermove={ghost ? (e) => (hover = pointFrom(e)) : undefined}
	onpointerleave={ghost ? () => (hover = null) : undefined}
>
	<defs>
		<!-- Black: matte slate with a soft sheen. -->
		<radialGradient id="{uid}-black" cx="0.38" cy="0.34" r="0.78">
			<stop offset="0" stop-color="#4a4d4b" />
			<stop offset="0.35" stop-color="#262827" />
			<stop offset="1" stop-color="#101111" />
		</radialGradient>
		<!-- White: muted ivory instead of glaring white. -->
		<radialGradient id="{uid}-white" cx="0.38" cy="0.34" r="0.82">
			<stop offset="0" stop-color="#fbf9f3" />
			<stop offset="0.6" stop-color="#efeadf" />
			<stop offset="1" stop-color="#cdc5b4" />
		</radialGradient>
		<radialGradient id="{uid}-sheen" cx="0.36" cy="0.3" r="0.35">
			<stop offset="0" stop-color="#ffffff" stop-opacity="0.55" />
			<stop offset="1" stop-color="#ffffff" stop-opacity="0" />
		</radialGradient>
		<!-- The fine grain of slate, as a tile drawn once. -->
		<filter id="{uid}-grain" x="0" y="0" width="100%" height="100%">
			<feTurbulence type="fractalNoise" baseFrequency="6" numOctaves="2" seed="3" />
			<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0" />
		</filter>
		<pattern id="{uid}-slate" patternUnits="userSpaceOnUse" width="4" height="4">
			<rect width="4" height="4" filter="url(#{uid}-grain)" />
		</pattern>
		<clipPath id="{uid}-shell-clip">
			<circle r={WHITE_RADIUS} />
		</clipPath>
		<!-- Growth lines of clam shell stones, a few variants around (0, 0). -->
		{#each SHELLS as lines, v (v)}
			<g id="{uid}-shell-{v}" clip-path="url(#{uid}-shell-clip)">
				{#each lines as line, i (i)}
					<path
						d={line.d}
						fill="none"
						stroke="#9c8f74"
						stroke-opacity={line.opacity}
						stroke-width={line.width}
					/>
				{/each}
				<circle r={WHITE_RADIUS} fill="url(#{uid}-sheen)" />
			</g>
		{/each}
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
			<g class:dead={stone.dead}>
				<circle
					class="stone {stone.color}"
					cx={stone.x}
					cy={stone.y}
					r={radius(stone.color)}
					fill="url(#{uid}-{stone.color})"
				/>
				{#if stone.color === 'white'}
					<use
						class="grain"
						href="#{uid}-shell-{shellVariant(stone.x, stone.y)}"
						x={stone.x}
						y={stone.y}
					/>
				{:else}
					<circle
						class="grain"
						cx={stone.x}
						cy={stone.y}
						r={STONE_RADIUS}
						fill="url(#{uid}-slate)"
					/>
				{/if}
			</g>
		{/each}
	</g>

	{#each marks as m (m.x + '-' + m.y)}
		{#if m.mark === 'pendingBlack' || m.mark === 'pendingWhite'}
			<circle
				class="pending"
				cx={m.x}
				cy={m.y}
				r={radius(m.mark === 'pendingBlack' ? 'black' : 'white')}
				fill="url(#{uid}-{m.mark === 'pendingBlack' ? 'black' : 'white'})"
			/>
		{:else if territoryStones && (m.mark === 'blackTerritory' || m.mark === 'whiteTerritory')}
			<circle
				class="territory-stone"
				cx={m.x}
				cy={m.y}
				r={TERRITORY_STONE_RADIUS}
				fill="url(#{uid}-{m.mark === 'blackTerritory' ? 'black' : 'white'})"
			/>
		{:else if territoryStones && m.mark === 'dead' && board[m.y]?.[m.x]}
			<circle
				class="territory-stone"
				cx={m.x}
				cy={m.y}
				r={TERRITORY_STONE_RADIUS}
				fill="url(#{uid}-{board[m.y]?.[m.x] === 'black' ? 'white' : 'black'})"
			/>
		{:else if m.mark === 'blackTerritory' || m.mark === 'whiteTerritory'}
			<rect
				class="territory {m.mark === 'blackTerritory' ? 'black' : 'white'}"
				x={m.x - 0.16}
				y={m.y - 0.16}
				width="0.32"
				height="0.32"
			/>
		{:else if m.mark === 'dead'}
			<g class="shape" stroke={ink(m.x, m.y)}>
				<line x1={m.x - 0.18} y1={m.y - 0.18} x2={m.x + 0.18} y2={m.y + 0.18} />
				<line x1={m.x - 0.18} y1={m.y + 0.18} x2={m.x + 0.18} y2={m.y - 0.18} />
			</g>
		{:else if SHAPES.has(m.mark)}
			<g class="shape" stroke={ink(m.x, m.y)}>
				{#if m.mark === 'triangle'}
					<polygon
						points="{m.x},{m.y - 0.26} {m.x + 0.23},{m.y + 0.15} {m.x - 0.23},{m.y + 0.15}"
					/>
				{:else if m.mark === 'square'}
					<rect x={m.x - 0.18} y={m.y - 0.18} width="0.36" height="0.36" />
				{:else if m.mark === 'circle'}
					<circle cx={m.x} cy={m.y} r="0.2" />
				{:else}
					<line x1={m.x - 0.18} y1={m.y - 0.18} x2={m.x + 0.18} y2={m.y + 0.18} />
					<line x1={m.x - 0.18} y1={m.y + 0.18} x2={m.x + 0.18} y2={m.y - 0.18} />
				{/if}
			</g>
		{/if}
	{/each}

	{#if last && colorAt(last.x, last.y)}
		<circle
			class="last {colorAt(last.x, last.y)}"
			cx={last.x}
			cy={last.y}
			r={oldschool ? 0.2 : 0.24}
		/>
	{/if}

	{#each texts as t (t.x + '-' + t.y)}
		<g class="text">
			{#if !colorAt(t.x, t.y)}
				<circle class="text-bg" cx={t.x} cy={t.y} r="0.34" />
			{/if}
			<text x={t.x} y={t.y + 0.16} fill={ink(t.x, t.y)}>{t.text}</text>
		</g>
	{/each}

	{#each labels as item (item.x + '-' + item.y)}
		<g class="label">
			<circle cx={item.x} cy={item.y} r="0.36" />
			<text x={item.x} y={item.y + 0.17}>{item.text}</text>
		</g>
	{/each}

	{#if showGhost && hover && ghost}
		<circle class="ghost" cx={hover.x} cy={hover.y} r={radius(ghost)} fill="url(#{uid}-{ghost})" />
	{/if}

	{#if onpoint}
		{#each { length: size * size }, i (i)}
			{@const x = i % size}
			{@const y = Math.floor(i / size)}
			<rect
				class="hit"
				x={x - 0.5}
				y={y - 0.5}
				width="1"
				height="1"
				role="presentation"
				onclick={() => onpoint({ x, y }, colorAt(x, y), markAt(x, y))}
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
		touch-action: manipulation;
	}

	.wood {
		fill: var(--board);
		stroke: var(--board-edge);
		stroke-width: 0.06;
	}

	.grid line,
	.grid .edge {
		stroke: var(--board-line);
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
		stroke: rgba(80, 60, 30, 0.22);
		stroke-width: 0.02;
	}

	.dead {
		opacity: 0.45;
	}

	.grain {
		pointer-events: none;
	}

	.pending,
	.ghost {
		opacity: 0.55;
		pointer-events: none;
	}

	.territory-stone {
		stroke: rgba(40, 30, 15, 0.35);
		stroke-width: 0.02;
		pointer-events: none;
	}

	.territory.black {
		fill: #111;
	}

	.territory.white {
		fill: #fff;
		stroke: rgba(0, 0, 0, 0.45);
		stroke-width: 0.03;
	}

	.shape {
		fill: none;
		stroke-width: 0.07;
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

	.text text,
	.label text {
		font-family: var(--font-ui);
		font-size: 0.42px;
		font-weight: 700;
		text-anchor: middle;
	}

	.text-bg {
		fill: var(--board);
	}

	.label circle {
		fill: var(--accent);
	}

	.label text {
		fill: var(--accent-ink);
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
	}

	.clickable .hit {
		cursor: pointer;
	}
</style>
