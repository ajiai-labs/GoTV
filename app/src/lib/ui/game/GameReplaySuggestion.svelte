<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	// Shown once a watched (not played) game ends: replay exactly this game on
	// the Nachspielen page - with the tree already in memory, no SGF needed.
	let {
		onReplay,
		onDismiss
	}: {
		onReplay: () => unknown;
		onDismiss: () => unknown;
	} = $props();
</script>

<div class="GameReplaySuggestion panel" role="status">
	<p class="GameReplaySuggestion-label">{t('game.replay.over')}</p>
	<div class="GameReplaySuggestion-buttons">
		<button type="button" class="button button-primary" onclick={() => onReplay()}>
			{t('game.replay.replay')}
		</button>
		<button type="button" class="button" onclick={() => onDismiss()}>
			{t('game.replay.close')}
		</button>
	</div>
</div>

<style>
	.GameReplaySuggestion {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 10px 16px;
		padding: 12px 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
	}

	.GameReplaySuggestion-label {
		margin: 0;
		font-weight: 600;
	}

	.GameReplaySuggestion-buttons {
		display: flex;
		gap: 8px;
	}

	:global([data-design='oldschool']) .GameReplaySuggestion {
		box-shadow: none;
		padding: 6px 8px;
	}
</style>
