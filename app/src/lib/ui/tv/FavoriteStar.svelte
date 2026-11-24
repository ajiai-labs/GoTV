<script lang="ts">
	// The star of "Mein GoTV" at a channel or tournament card.
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		active,
		name,
		onToggle
	}: {
		active: boolean;
		// What gets starred, for the tooltip and screen readers.
		name: string;
		onToggle: () => unknown;
	} = $props();

	let label = $derived(active ? t('tv.favorite.remove', { name }) : t('tv.favorite.add', { name }));
</script>

<button
	type="button"
	class="FavoriteStar"
	class:FavoriteStar-active={active}
	aria-pressed={active}
	aria-label={label}
	title={label}
	onclick={() => onToggle()}
>
	{active ? '★' : '☆'}
</button>

<style>
	.FavoriteStar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		min-height: 32px;
		padding: 0 4px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		color: var(--ink-soft);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		vertical-align: middle;
	}

	.FavoriteStar:hover,
	.FavoriteStar-active {
		color: #c8962b;
	}
</style>
