<script lang="ts" module>
	import type { RankGraph } from '#lib/model/types.ts';

	type Point = { x: Date; y: number | null };

	// KGS ranks as numbers (parseRankGraph): 0 is 1d, 100 is 2d, -100 is 1k.
	// There is no rank between 1k and 1d, so dan ranks are bumped up by one.
	export function rankLabel(value: number): string | null {
		const kyu = value < 0;
		let rank = Math.abs(value / 100);
		if (!kyu) rank += 1;
		if ((!kyu && rank <= 9) || (kyu && rank <= 30)) return `${rank}${kyu ? 'k' : 'd'}`;
		return null;
	}

	const MONTH = new Intl.DateTimeFormat('de-DE', { month: 'short' });
	const MONTH_YEAR = new Intl.DateTimeFormat('de-DE', { month: 'short', year: 'numeric' });
	const DAY_MONTH = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
	const FULL = new Intl.DateTimeFormat('de-DE', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	// The x labels of the old Chartist graph: with more than two months the
	// first day of each month (with the year for January and the first
	// month), otherwise about ten evenly spaced days.
	export function dateLabel(
		date: Date,
		index: number,
		count: number,
		months: number
	): string | null {
		if (months > 2) {
			if (date.getDate() !== 1) return null;
			return index < 31 || date.getMonth() === 0 ? MONTH_YEAR.format(date) : MONTH.format(date);
		}
		const ratio = count / 10;
		if (ratio > 0 && Math.floor(index % ratio) !== 0) return null;
		return index === 0 ? FULL.format(date) : DAY_MONTH.format(date);
	}
</script>

<script lang="ts">
	// A user's rank over time, drawn as SVG (the old app used Chartist).
	import Spinner from '#lib/ui/Spinner.svelte';

	let { graph }: { graph: RankGraph | null | undefined } = $props();

	const HEIGHT = 250;
	const PAD = { top: 12, right: 40, bottom: 34, left: 44 };
	const MIN_LABEL_GAP = 56;

	let width = $state(0);

	let series = $derived((graph?.data.series[0] ?? []) as Array<Point>);
	let values = $derived(series.map((p) => p.y).filter((y): y is number => y !== null));

	let scale = $derived.by(() => {
		const yMin = Math.floor(Math.min(...values) / 100) * 100;
		const yMax = Math.max(Math.ceil(Math.max(...values) / 100) * 100, yMin + 100);
		const ticks: Array<number> = [];
		for (let i = yMin; i <= yMax; i += 100) ticks.push(i);
		const plotW = Math.max(width - PAD.left - PAD.right, 1);
		const plotH = HEIGHT - PAD.top - PAD.bottom;
		const x = (i: number) => PAD.left + (series.length > 1 ? (i / (series.length - 1)) * plotW : 0);
		const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
		return { ticks, x, y };
	});

	// One path, interrupted where KGS has no rank for a day.
	let path = $derived.by(() => {
		let d = '';
		let pen = false;
		series.forEach((p, i) => {
			if (p.y === null) {
				pen = false;
				return;
			}
			d += `${pen ? 'L' : 'M'}${scale.x(i).toFixed(1)},${scale.y(p.y).toFixed(1)}`;
			pen = true;
		});
		return d;
	});

	// Labels that would run into each other on a narrow screen are left out.
	let xLabels = $derived.by(() => {
		const labels: Array<{ i: number; text: string }> = [];
		let lastX = -Infinity;
		series.forEach((p, i) => {
			const text = dateLabel(new Date(p.x), i, series.length, graph?.months.length ?? 0);
			if (text === null || scale.x(i) - lastX < MIN_LABEL_GAP) return;
			labels.push({ i, text });
			lastX = scale.x(i);
		});
		return labels;
	});

	let summary = $derived.by(() => {
		if (!values.length) return '';
		const last = values[values.length - 1];
		const current = rankLabel(Math.round(last / 100) * 100);
		return `Rangverlauf der letzten ${series.length} Tage${current ? `, zuletzt etwa ${current}` : ''}`;
	});
</script>

<div class="UserRankGraph" bind:clientWidth={width}>
	{#if !graph}
		<Spinner label="Rangverlauf lädt …" />
	{:else if !values.length}
		<p class="UserRankGraph-none muted">Für diesen Spieler gibt es keinen Rangverlauf.</p>
	{:else if width > 0}
		<svg {width} height={HEIGHT} role="img" aria-label={summary}>
			{#each scale.ticks as tick (tick)}
				{@const label = rankLabel(tick)}
				<line
					class="grid"
					x1={PAD.left}
					x2={width - PAD.right}
					y1={scale.y(tick)}
					y2={scale.y(tick)}
				/>
				{#if label}
					<text class="label" x={PAD.left - 8} y={scale.y(tick)} text-anchor="end" dy="0.35em">
						{label}
					</text>
				{/if}
			{/each}
			{#each xLabels as label (label.i)}
				<line
					class="grid"
					x1={scale.x(label.i)}
					x2={scale.x(label.i)}
					y1={PAD.top}
					y2={HEIGHT - PAD.bottom}
				/>
				<text
					class="label"
					x={scale.x(label.i)}
					y={HEIGHT - PAD.bottom + 18}
					text-anchor={label.i === 0 ? 'start' : 'middle'}
				>
					{label.text}
				</text>
			{/each}
			<path class="line" d={path} />
		</svg>
	{/if}
</div>

<style>
	.UserRankGraph {
		width: 100%;
		min-height: 60px;
		overflow: hidden;
	}

	svg {
		display: block;
	}

	.grid {
		stroke: var(--rule);
		stroke-width: 1;
		stroke-dasharray: 2 3;
	}

	.label {
		fill: var(--ink-soft);
		font-size: 11px;
	}

	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.UserRankGraph-none {
		margin: 16px 0;
	}

	:global([data-design='oldschool']) .grid {
		stroke-dasharray: none;
	}

	:global([data-design='oldschool']) .line {
		stroke-width: 2;
	}
</style>
