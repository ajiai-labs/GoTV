<script lang="ts">
	// The input line under a chat. Enter sends. On devices with a keyboard it
	// takes the focus when shown and whenever another chat is opened.
	import type { Conversation } from '#lib/model/types.ts';
	import { isTouchDevice } from '#lib/util/dom.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		conversation,
		onSubmit
	}: {
		conversation: Conversation | null | undefined;
		onSubmit: (body: string) => unknown;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let text = $state('');

	let disabled = $derived(!conversation || !!conversation.chatsDisabled);
	// Only the id: a new message gives a new conversation object, and that
	// must not pull the focus back here.
	let conversationId = $derived(conversation?.id);

	$effect(() => {
		// Runs on mount and whenever another conversation is shown.
		void conversationId;
		if (input && !isTouchDevice()) input.focus();
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!conversation || conversation.chatsDisabled || conversation.status !== 'created') {
			return;
		}
		const body = text.trim();
		if (!body) return;
		text = '';
		onSubmit(body);
	}
</script>

<div class="ChatMessageBar">
	<form action="#" method="post" onsubmit={submit}>
		<input
			bind:this={input}
			bind:value={text}
			class="ChatMessageBar-input"
			type="text"
			enterkeyhint="send"
			autocomplete="off"
			aria-label={t('chat.bar.label')}
			placeholder={disabled ? t('chat.disabled') : t('chat.bar.placeholder')}
		/>
	</form>
</div>

<style>
	.ChatMessageBar-input {
		width: 100%;
		min-height: 40px;
		padding: 8px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		/* 16px keeps iOS Safari from zooming in on focus */
		font-size: max(16px, 1em);
	}

	.ChatMessageBar-input:focus {
		border-color: var(--accent);
		outline: 2px solid var(--accent-soft);
		outline-offset: 0;
	}

	:global([data-design='oldschool']) .ChatMessageBar-input {
		min-height: 28px;
		padding: 3px 6px;
		border: 2px inset var(--bevel-face, #ece9e2);
		border-radius: 0;
		background: var(--surface-sunk);
		font-size: max(16px, 1em);
	}
</style>
