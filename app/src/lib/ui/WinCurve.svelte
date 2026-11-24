<script lang="ts">
	// Black's chance to win over the game as one thin line - the "horizon"
	// under the board. Above the middle line black leads, below white.
	import { t } from '#lib/i18n/index.svelte.ts';
	let {
		values,
		current = values.length - 1,
		onmove
	}: {
		values: Array<number>;
		current?: number;
		onmove?: (move: number) => void;
	} = $props();

	const WIDTH = 600;
	const HEIGHT = 56;

	let points = $derived(
		values
			.map((v, i) => {
				const x = (i / Math.max(1, values.length - 1)) * WIDTH;
				const y = (1 - Math.max(0, Math.min(1, v))) * HEIGHT;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ')
	);
	let currentX = $derived((current / Math.max(1, values.length - 1)) * WIDTH);
	let currentValue = $derived(values[current] ?? 0.5);

	// Arrow keys move one move, Page keys ten, Home/End to the ends.
	function key(event: KeyboardEvent) {
		if (!onmove) return;
		const steps: Record<string, number> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			PageDown: -10,
			PageUp: 10
		};
		let next: number | null = null;
		if (event.key in steps) next = current + steps[event.key];
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = values.length - 1;
		if (next === null) return;
		event.preventDefault();
		onmove(Math.max(0, Math.min(values.length - 1, next)));
	}

	function pick(event: MouseEvent) {
		if (!onmove) return;
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const share = box.width ? (event.clientX - box.left) / box.width : 0;
		onmove(Math.round(share * (values.length - 1)));
	}
</script>

<figure class="curve">
	{#snippet lines()}
		<line class="middle" x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} />
		<polyline class="line" {points} />
		<line class="now" x1={currentX} x2={currentX} y1="0" y2={HEIGHT} />
	{/snippet}
	{#if onmove}
		<svg
			class="pick"
			viewBox="0 0 {WIDTH} {HEIGHT}"
			preserveAspectRatio="none"
			role="slider"
			tabindex="0"
			aria-label={t('app.winCurve.label')}
			aria-valuemin={0}
			aria-valuemax={values.length - 1}
			aria-valuenow={current}
			aria-valuetext={t('app.winCurve.valuetext', {
				move: current,
				percent: Math.round(currentValue * 100)
			})}
			onclick={pick}
			onkeydown={key}
		>
			{@render lines()}
		</svg>
	{:else}
		<svg
			viewBox="0 0 {WIDTH} {HEIGHT}"
			preserveAspectRatio="none"
			role="img"
			aria-label={t('app.winCurve.labelNow', { percent: Math.round(currentValue * 100) })}
		>
			{@render lines()}
		</svg>
	{/if}
	<figcaption>
		<span>{t('app.winCurve.black', { percent: Math.round(currentValue * 100) })}</span>
		<span class="muted">
			{t('app.winCurve.white', { percent: 100 - Math.round(currentValue * 100) })}
		</span>
	</figcaption>
</figure>

<style>
	.curve {
		margin: 0;
	}

	svg {
		display: block;
		width: 100%;
		height: 44px;
	}

	.pick {
		cursor: pointer;
	}

	.middle {
		stroke: var(--rule);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.line {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.6;
		vector-effect: non-scaling-stroke;
	}

	.now {
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	figcaption {
		display: flex;
		justify-content: space-between;
		font-size: 0.85em;
		margin-top: 2px;
	}
</style>
