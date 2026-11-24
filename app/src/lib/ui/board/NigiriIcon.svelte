<script lang="ts">
	// Nigiri (colours decided by guessing stones): one stone, half black and
	// half white, split diagonally.
	let { label = 'Nigiri' }: { label?: string } = $props();
</script>

<svg class="NigiriIcon" viewBox="0 0 24 24" role="img" aria-label={label}>
	<title>{label}</title>
	<circle cx="12" cy="12" r="11" class="white" />
	<path d="M 4.22 19.78 A 11 11 0 0 1 19.78 4.22 Z" class="black" />
	<circle cx="12" cy="12" r="11" class="rim" />
</svg>

<style>
	.NigiriIcon {
		display: block;
		width: 100%;
		height: 100%;
	}

	.white {
		fill: #f4f1ea;
	}

	.black {
		fill: #1b1b1b;
	}

	.rim {
		fill: none;
		stroke: #1b1b1b;
		stroke-width: 1;
	}
</style>
