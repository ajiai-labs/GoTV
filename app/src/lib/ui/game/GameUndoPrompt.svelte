<script lang="ts">
	// A player asks to take back a move: allow or deny.
	import type { GameRole } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	const uid = $props.id();

	// `role` (who asked) is part of the props as before; the text does not
	// need it.
	// eslint-disable-next-line svelte/no-unused-props -- kept for callers, as in the old app
	let {
		onAccept,
		onDecline
	}: {
		role: GameRole;
		onAccept: () => unknown;
		onDecline: () => unknown;
	} = $props();
</script>

<div class="GameUndoPrompt panel" role="alertdialog" aria-labelledby="{uid}-label">
	<p id="{uid}-label" class="GameUndoPrompt-label">{t('game.undo.request')}</p>
	<div class="GameUndoPrompt-buttons">
		<button type="button" class="button button-primary" onclick={() => onAccept()}>
			{t('game.undo.allow')}
		</button>
		<button type="button" class="button" onclick={() => onDecline()}>
			{t('game.undo.decline')}
		</button>
	</div>
</div>

<style>
	.GameUndoPrompt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 10px 16px;
		padding: 12px 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
	}

	.GameUndoPrompt-label {
		margin: 0;
		font-weight: 600;
	}

	.GameUndoPrompt-buttons {
		display: flex;
		gap: 8px;
	}

	:global([data-design='oldschool']) .GameUndoPrompt {
		box-shadow: none;
		padding: 6px 8px;
	}
</style>
