<script lang="ts">
	let { label = 'Lädt …' }: { label?: string } = $props();
</script>

<div class="spinner" role="status">
	<span class="dot" aria-hidden="true"></span>
	<span class="text">{label}</span>
</div>

<style>
	.spinner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 24px;
		color: var(--ink-soft);
	}

	.dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--rule);
		border-top-color: var(--accent);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
