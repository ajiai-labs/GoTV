<script lang="ts">
	// "Nachricht hinterlassen" (CGoban): a message for a player who is not
	// online; KGS delivers it at their next login (max. 1000 characters).
	// Is the player online, KGS opens a private chat instead.
	import { app } from '#lib/app.svelte.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	let { to = '' }: { to?: string } = $props();

	const uid = $props.id();
	// svelte-ignore state_referenced_locally
	let name = $state(to);
	let text = $state('');
	let sent = $state(false);

	const RESULTS: Record<string, MessageKey> = {
		MESSAGE_CREATE_SUCCESS: 'community.message.success',
		MESSAGE_CREATE_NO_USER: 'community.message.noUser',
		MESSAGE_CREATE_FULL: 'community.message.full',
		MESSAGE_CREATE_CONNECTED: 'community.message.connected'
	};
	let result = $derived.by(() => {
		const type = app.state.communityResult?.type;
		return sent && type && RESULTS[type] ? RESULTS[type] : null;
	});

	$effect(() => {
		if (app.state.communityResult?.type === 'MESSAGE_CREATE_SUCCESS' && sent) text = '';
	});

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || !text.trim()) return;
		app.actions.onLeaveMessage(name, text);
		sent = true;
	}
</script>

<form class="LeaveMessageForm" onsubmit={onSubmit} aria-labelledby="{uid}-title">
	<p id="{uid}-title" class="LeaveMessageForm-hint muted">{t('community.message.hint')}</p>
	<label>
		<span>{t('community.message.to')}</span>
		<input type="text" bind:value={name} maxlength="10" autocomplete="off" required />
	</label>
	<label>
		<span>{t('community.message.text')}</span>
		<textarea bind:value={text} maxlength="1000" rows="4" required></textarea>
	</label>
	<div class="LeaveMessageForm-actions">
		<button type="submit" class="button button-primary">{t('community.message.send')}</button>
		<span class="muted">{text.length} / 1000</span>
	</div>
	{#if result}
		<p
			class="LeaveMessageForm-result"
			class:error={result !== 'community.message.success'}
			role="status"
		>
			{t(result)}
		</p>
	{/if}
</form>

<style>
	.LeaveMessageForm {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.LeaveMessageForm label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.LeaveMessageForm-hint,
	.LeaveMessageForm-result {
		margin: 0;
	}

	.LeaveMessageForm-result.error {
		color: #c0392b;
	}

	.LeaveMessageForm-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
</style>
