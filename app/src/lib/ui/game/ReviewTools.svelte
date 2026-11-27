<script lang="ts">
	// The controls of a KGS review (27.11.2026, as in CGoban): who has the
	// control; for whoever has it the tools (stone or a mark); for the owner
	// giving the control to someone in the review and saving it in the KGS
	// archive.
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { ReviewTool } from '#lib/model/game/review.ts';
	import type { SaveStatus } from '#lib/model/types.ts';

	let {
		editor,
		editing,
		owner,
		saved,
		saveStatus,
		users,
		me,
		tool = $bindable('stone'),
		onGiveControl,
		onSave
	}: {
		editor: string;
		editing: boolean;
		owner: boolean;
		saved: boolean;
		// Whether "Im KGS-Archiv speichern" is on its way or failed.
		saveStatus?: SaveStatus;
		users: Array<string>;
		me: string;
		tool?: ReviewTool;
		onGiveControl: (name: string) => void;
		onSave: () => void;
	} = $props();

	const TOOLS: Array<{ id: ReviewTool; symbol: string; label: MessageKey }> = [
		{ id: 'stone', symbol: '●', label: 'game.review.toolStone' },
		{ id: 'TRIANGLE', symbol: '△', label: 'game.review.toolTriangle' },
		{ id: 'SQUARE', symbol: '□', label: 'game.review.toolSquare' },
		{ id: 'CIRCLE', symbol: '○', label: 'game.review.toolCircle' },
		{ id: 'CROSS', symbol: '✕', label: 'game.review.toolCross' },
		{ id: 'LABEL', symbol: 'A', label: 'game.review.toolLabel' }
	];

	let others = $derived(users.filter((name) => name.toLowerCase() !== editor.toLowerCase()));
	let giveTo = $state('');
</script>

<div class="ReviewTools">
	<p class="control">
		{editing ? t('game.review.youControl') : t('game.review.control', { name: editor })}
	</p>
	{#if editing}
		<div class="tools" role="radiogroup" aria-label={t('game.review.tools')}>
			{#each TOOLS as item (item.id)}
				<button
					type="button"
					role="radio"
					class="tool"
					aria-checked={tool === item.id}
					aria-label={t(item.label)}
					title={t(item.label)}
					onclick={() => (tool = item.id)}
				>
					{item.symbol}
				</button>
			{/each}
		</div>
	{/if}
	{#if owner}
		<div class="owner">
			{#if editing && others.length}
				<label>
					<span class="sr-only">{t('game.review.giveTo')}</span>
					<select bind:value={giveTo}>
						<option value="">{t('game.review.giveTo')}</option>
						{#each others as name (name)}
							<option value={name}>{name}</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="button"
					disabled={!giveTo}
					onclick={() => {
						onGiveControl(giveTo);
						giveTo = '';
					}}
				>
					{t('game.review.give')}
				</button>
			{:else if !editing}
				<button type="button" class="button" onclick={() => onGiveControl(me)}>
					{t('game.review.takeBack')}
				</button>
			{/if}
			{#if saved}
				<span class="saved">{t('game.review.saved')}</span>
			{:else}
				<button
					type="button"
					class="button"
					disabled={saveStatus === 'saving'}
					onclick={() => onSave()}
				>
					{saveStatus === 'saving'
						? t('game.review.saving')
						: saveStatus === 'failed'
							? t('game.review.saveAgain')
							: t('game.review.save')}
				</button>
				{#if saveStatus === 'failed'}
					<span class="error" role="alert">{t('game.review.saveFailed')}</span>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.ReviewTools {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 8px;
	}

	.control {
		margin: 0;
		font-size: 0.9rem;
		color: var(--ink-soft, #555);
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tool {
		min-width: 36px;
		min-height: 36px;
		border: 1px solid var(--rule);
		border-radius: 8px;
		background: var(--panel, #fff);
		color: inherit;
		font-size: 1.05rem;
		cursor: pointer;
	}

	.tool[aria-checked='true'] {
		border-color: var(--accent, #1f7a5a);
		background: var(--accent-soft, #e3f1eb);
		font-weight: 700;
	}

	.owner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.owner select {
		max-width: 12rem;
	}

	.saved {
		font-size: 0.9rem;
		color: var(--ink-soft, #555);
	}

	.error {
		font-size: 0.9rem;
		color: var(--danger, #b3261e);
	}
</style>
