<script lang="ts">
	// Marks which Go server a board comes from. Games parsed by KgsClient carry
	// no tvSource, so everything that is not explicitly OGS is a KGS board.
	import type { GameChannel } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { game }: { game: GameChannel } = $props();

	let isOgs = $derived(game.tvSource === 'ogs');
</script>

<span
	class="TvSourceBadge TvSourceBadge-{isOgs ? 'ogs' : 'kgs'}"
	title={isOgs ? t('tv.source.ogs') : t('tv.source.kgs')}
>
	{isOgs ? 'OGS' : 'KGS'}
</span>

<style>
	.TvSourceBadge {
		display: inline-block;
		padding: 1px 7px;
		border-radius: var(--radius-pill);
		font-size: 11px;
		font-weight: 700;
		line-height: 1.5;
		letter-spacing: 0.5px;
		color: #ffffff;
		vertical-align: middle;
	}

	.TvSourceBadge-kgs {
		background: #3a4540;
	}

	.TvSourceBadge-ogs {
		background: #1f6b80;
	}
</style>
