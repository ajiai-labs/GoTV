<script lang="ts">
	// A vertical handle between two columns that the user drags (mouse, touch,
	// pen) or moves with the arrow keys. It only reports; the parent turns the
	// pointer position or key step into its own value (percent, pixels, ...).
	// role="slider" (not "separator"): a draggable separator with a value is
	// announced as a slider, and keyboard users can operate it.
	let {
		label,
		valuenow,
		valuemin,
		valuemax,
		valuetext,
		onpointer,
		onkey
	}: {
		label: string;
		valuenow: number;
		valuemin: number;
		valuemax: number;
		valuetext?: string;
		// Pointer position while dragging (clientX).
		onpointer: (clientX: number) => void;
		// Arrow keys: -1 / +1, Home/End: 'min' / 'max'.
		onkey: (step: -1 | 1 | 'min' | 'max') => void;
	} = $props();

	let dragging = $state(false);

	function down(event: PointerEvent) {
		event.preventDefault();
		dragging = true;
		const target = event.currentTarget as HTMLElement;
		// Keeps the drag when the pointer passes over an iframe or the board.
		target.setPointerCapture?.(event.pointerId);
	}

	function move(event: PointerEvent) {
		if (dragging) onpointer(event.clientX);
	}

	function up(event: PointerEvent) {
		dragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
	}

	function key(event: KeyboardEvent) {
		const steps: Record<string, -1 | 1 | 'min' | 'max'> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			Home: 'min',
			End: 'max'
		};
		const step = steps[event.key];
		if (step === undefined) return;
		event.preventDefault();
		// The move bar of the game listens to the arrow keys too.
		event.stopPropagation();
		onkey(step);
	}
</script>

<div
	class="splitter"
	class:dragging
	role="slider"
	tabindex="0"
	aria-label={label}
	aria-orientation="horizontal"
	aria-valuenow={valuenow}
	aria-valuemin={valuemin}
	aria-valuemax={valuemax}
	aria-valuetext={valuetext}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onkeydown={key}
>
	<span class="grip" aria-hidden="true"></span>
</div>

<style>
	.splitter {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		cursor: col-resize;
		touch-action: none;
		border-radius: var(--radius-pill);
	}

	.grip {
		width: 4px;
		height: 48px;
		border-radius: 2px;
		background: var(--rule);
	}

	.splitter:hover .grip,
	.splitter:focus-visible .grip,
	.dragging .grip {
		background: var(--accent);
	}
</style>
