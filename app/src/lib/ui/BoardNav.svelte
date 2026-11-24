<script lang="ts">
	// Move bar under a board: start, back, slider, forward, end. Arrow keys
	// step one move, Home/End jump to the ends (not while typing in a field).
	// With `latest` set (live board), "end" means "follow the game again".
	let {
		move = $bindable(),
		total,
		latest = null
	}: {
		move: number;
		total: number;
		latest?: number | null;
	} = $props();

	let last = $derived(latest ?? total);

	function go(next: number) {
		move = Math.max(0, Math.min(last, next));
	}

	function onkey(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) {
			return;
		}
		const keys: Record<string, () => void> = {
			ArrowLeft: () => go(move - 1),
			ArrowRight: () => go(move + 1),
			Home: () => go(0),
			End: () => go(last)
		};
		if (keys[event.key]) {
			event.preventDefault();
			keys[event.key]();
		}
	}
</script>

<svelte:window onkeydown={onkey} />

<div class="nav" role="group" aria-label="Züge">
	<button class="button" onclick={() => go(0)} aria-label="Zum Anfang" disabled={move === 0}>
		⏮
	</button>
	<button
		class="button"
		onclick={() => go(move - 1)}
		aria-label="Ein Zug zurück"
		disabled={move === 0}
	>
		◀
	</button>
	<input
		type="range"
		min="0"
		max={last}
		value={move}
		oninput={(e) => go(Number(e.currentTarget.value))}
		aria-label="Zug wählen"
		aria-valuetext="Zug {move} von {last}"
	/>
	<button
		class="button"
		onclick={() => go(move + 1)}
		aria-label="Ein Zug vor"
		disabled={move === last}
	>
		▶
	</button>
	<button
		class="button"
		onclick={() => go(last)}
		aria-label={latest !== null ? 'Zum aktuellen Zug' : 'Zum letzten Zug'}
		disabled={move === last}
	>
		⏭
	</button>
</div>

<style>
	.nav {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: 8px;
	}

	input {
		flex: 1;
		min-width: 0;
		accent-color: var(--accent);
	}

	.button:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
