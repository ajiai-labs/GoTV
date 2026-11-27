<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	// Shown once a game ends: replay exactly this game on the Nachspielen page -
	// with the tree already in memory, no SGF needed. For a game the viewer
	// played (onReview given) also "Mit KataGo auswerten": the same with KataGo
	// switched on. Never offered while a game runs (no help during a game).
	// onDiscuss: "Mit Gegner besprechen" - a KGS review together with the
	// opponent (GAME_START_REVIEW), for a game the viewer played.
	let {
		onReplay,
		onReview,
		onDiscuss,
		onDismiss
	}: {
		onReplay: () => unknown;
		onReview?: () => unknown;
		onDiscuss?: () => unknown;
		onDismiss: () => unknown;
	} = $props();
</script>

<div class="GameReplaySuggestion panel" role="status">
	<p class="GameReplaySuggestion-label">{t('game.replay.over')}</p>
	<div class="GameReplaySuggestion-buttons">
		<button type="button" class="button button-primary" onclick={() => onReplay()}>
			{t('game.replay.replay')}
		</button>
		{#if onReview}
			<button type="button" class="button" onclick={() => onReview()}>
				{t('game.replay.review')}
			</button>
		{/if}
		{#if onDiscuss}
			<button type="button" class="button" onclick={() => onDiscuss()}>
				{t('game.replay.discuss')}
			</button>
		{/if}
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
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}

	:global([data-design='oldschool']) .GameReplaySuggestion {
		box-shadow: none;
		padding: 6px 8px;
	}
</style>
