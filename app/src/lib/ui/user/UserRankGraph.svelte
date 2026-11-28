<script lang="ts" module>
	import type { RankGraph } from '#lib/model/types.ts';
	import { locale, t } from '#lib/i18n/index.svelte.ts';

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

	const FORMATS = {
		month: { month: 'short' },
		year: { year: 'numeric' },
		dayMonth: { day: 'numeric', month: 'short' },
		full: { day: 'numeric', month: 'short', year: 'numeric' }
	} satisfies Record<string, Intl.DateTimeFormatOptions>;

	// In the interface language's locale.
	export function formatDate(date: Date, format: keyof typeof FORMATS): string {
		return new Intl.DateTimeFormat(locale(), FORMATS[format]).format(date);
	}

	// The x labels: with more than two months the first day of each month,
	// with the year in a second line under the first label and under each
	// January (as CGoban); otherwise about ten evenly spaced days.
	export function dateLabel(
		date: Date,
		index: number,
		count: number,
		months: number
	): { text: string; year: string | null } | null {
		if (months > 2) {
			if (date.getDate() !== 1) return null;
			const withYear = index < 31 || date.getMonth() === 0;
			return { text: formatDate(date, 'month'), year: withYear ? formatDate(date, 'year') : null };
		}
		const ratio = count / 10;
		if (ratio > 0 && Math.floor(index % ratio) !== 0) return null;
		return {
			text: index === 0 ? formatDate(date, 'full') : formatDate(date, 'dayMonth'),
			year: null
		};
	}
</script>

<script lang="ts">
	// A user's rank over time, drawn as SVG (the old app used Chartist).
	// Detailed like CGoban's rank graph (user, 28.11.2026): a thin line that
	// keeps the daily ups and downs, a line for every rank and fine ones for
	// each quarter rank, the period in the title, the years under the months.
	import Spinner from '#lib/ui/Spinner.svelte';

	let { graph, name = '' }: { graph: RankGraph | null | undefined; name?: string } = $props();

	const HEIGHT = 300;
	const PAD = { top: 14, right: 24, bottom: 44, left: 44 };
	const MIN_LABEL_GAP = 44;
	const RANK = 100;
	const QUARTER = RANK / 4;

	let width = $state(0);

	let series = $derived((graph?.data.series[0] ?? []) as Array<Point>);
	let values = $derived(series.map((p) => p.y).filter((y): y is number => y !== null));

	let scale = $derived.by(() => {
		const yMin = Math.floor(Math.min(...values) / RANK) * RANK;
		const yMax = Math.max(Math.ceil(Math.max(...values) / RANK) * RANK, yMin + RANK);
		const ticks: Array<number> = [];
		for (let i = yMin; i <= yMax; i += RANK) ticks.push(i);
		// Quarter ranks only while there is room (at most four ranks shown).
		const minor: Array<number> = [];
		if (ticks.length <= 5) {
			for (let i = yMin + QUARTER; i < yMax; i += QUARTER) if (i % RANK) minor.push(i);
		}
		const plotW = Math.max(width - PAD.left - PAD.right, 1);
		const plotH = HEIGHT - PAD.top - PAD.bottom;
		const x = (i: number) => PAD.left + (series.length > 1 ? (i / (series.length - 1)) * plotW : 0);
		const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
		return { ticks, minor, x, y };
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

	// Labels that would run into each other on a narrow screen are left out
	// (a year label is kept and takes the place of the month before it).
	let xLabels = $derived.by(() => {
		const labels: Array<{ i: number; text: string; year: string | null }> = [];
		let lastX = -Infinity;
		series.forEach((p, i) => {
			const label = dateLabel(new Date(p.x), i, series.length, graph?.months.length ?? 0);
			if (label === null) return;
			if (scale.x(i) - lastX < MIN_LABEL_GAP) {
				if (!label.year || !labels.length) return;
				labels.pop();
			}
			labels.push({ i, ...label });
			lastX = scale.x(i);
		});
		return labels;
	});

	let title = $derived.by(() => {
		const first = series[0];
		const last = series[series.length - 1];
		if (!first || !last) return '';
		return t('chat.rankGraph.title', {
			name,
			from: formatDate(new Date(first.x), 'full'),
			to: formatDate(new Date(last.x), 'full')
		});
	});

	let summary = $derived.by(() => {
		if (!values.length) return '';
		const last = values[values.length - 1];
		const current = rankLabel(Math.round(last / RANK) * RANK);
		return current
			? t('chat.rankGraph.summaryCurrent', { count: series.length, rank: current })
			: t('chat.rankGraph.summary', { count: series.length });
	});
</script>

<div class="UserRankGraph" bind:clientWidth={width}>
	{#if !graph}
		<Spinner label={t('chat.rankGraph.loading')} />
	{:else if !values.length}
		<p class="UserRankGraph-none muted">{t('chat.rankGraph.none')}</p>
	{:else if width > 0}
		{#if name}
			<p class="UserRankGraph-title">{title}</p>
		{/if}
		<svg {width} height={HEIGHT} role="img" aria-label={summary}>
			<rect
				class="plot"
				x={PAD.left}
				y={PAD.top}
				width={Math.max(width - PAD.left - PAD.right, 0)}
				height={HEIGHT - PAD.top - PAD.bottom}
			/>
			{#each scale.minor as tick (tick)}
				<line
					class="grid minor"
					x1={PAD.left}
					x2={width - PAD.right}
					y1={scale.y(tick)}
					y2={scale.y(tick)}
				/>
			{/each}
			{#each xLabels as label (label.i)}
				<line
					class="grid month"
					x1={scale.x(label.i)}
					x2={scale.x(label.i)}
					y1={PAD.top}
					y2={HEIGHT - PAD.bottom + 4}
				/>
				<text
					class="label"
					x={scale.x(label.i) + 3}
					y={HEIGHT - PAD.bottom + 16}
					text-anchor="start"
				>
					{label.text}
				</text>
				{#if label.year}
					<text class="label year" x={scale.x(label.i) + 3} y={HEIGHT - PAD.bottom + 31}>
						{label.year}
					</text>
				{/if}
			{/each}
			{#each scale.ticks as tick (tick)}
				{@const label = rankLabel(tick)}
				<line
					class="grid rank"
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

	.UserRankGraph-title {
		margin: 0 0 6px;
		text-align: center;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	svg {
		display: block;
	}

	.grid {
		stroke: var(--rule);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.grid.minor {
		stroke-dasharray: 2 4;
		opacity: 0.7;
	}

	.grid.month {
		stroke-dasharray: 2 3;
	}

	.grid.rank {
		stroke: var(--ink-soft);
		opacity: 0.45;
	}

	.label {
		fill: var(--ink-soft);
		font-size: 11px;
	}

	.label.year {
		font-weight: 600;
	}

	/* Thin, not smoothed: the daily ups and downs stay visible. */
	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-linejoin: miter;
	}

	.UserRankGraph-none {
		margin: 16px 0;
	}

	.plot {
		fill: transparent;
	}

	/* Classic: CGoban's black plot with a green line. */
	:global([data-design='oldschool']) .plot {
		fill: #000;
	}

	:global([data-design='oldschool']) .line {
		stroke: #5cdb5c;
	}

	:global([data-design='oldschool']) .grid {
		stroke: #8a8a8a;
	}

	:global([data-design='oldschool']) .grid.minor {
		opacity: 0.35;
	}

	:global([data-design='oldschool']) .grid.minor,
	:global([data-design='oldschool']) .grid.month {
		stroke-dasharray: none;
		opacity: 0.5;
	}
</style>
