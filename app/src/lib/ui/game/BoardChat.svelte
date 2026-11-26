<script lang="ts">
	// The chat of a game next to its board, e.g. an enlarged board in the
	// Brettübersicht (wish of the user, 26.11.2026): read along and write.
	// The same chat as on the game screen (GameChat), following new lines.
	import { tick } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { getGameChatSections } from '#lib/model/game/index.ts';
	import type { GameChannel } from '#lib/model/types.ts';
	import ChatMessageBar from '#lib/ui/chat/ChatMessageBar.svelte';
	import GameChat from './GameChat.svelte';

	let { game }: { game: GameChannel } = $props();

	let scroller: HTMLElement | undefined = $state();
	let chatSections = $derived(getGameChatSections(game));
	let signature = $derived.by(() => {
		const last = chatSections[chatSections.length - 1];
		return `${chatSections.length}:${last?.messages?.length ?? 0}:${last?.actions.length ?? 0}`;
	});

	$effect(() => {
		void signature;
		void tick().then(() => {
			if (scroller) scroller.scrollTop = scroller.scrollHeight;
		});
	});
</script>

<section class="BoardChat" aria-label={t('game.boardChat')}>
	<div class="BoardChat-scroll" bind:this={scroller}>
		<GameChat {chatSections} />
	</div>
	<ChatMessageBar
		conversation={{ id: 0, messages: [], status: 'created', chatsDisabled: !game.tree }}
		onSubmit={(body: string) => app.actions.onSendGameChat(body, game.id)}
	/>
</section>

<style>
	.BoardChat {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border: 1px solid var(--panel-border);
		border-radius: var(--radius-m);
		background: var(--surface);
		overflow: hidden;
	}

	.BoardChat-scroll {
		flex: 1;
		min-height: 0;
		padding: 4px 12px;
		overflow-y: auto;
	}
</style>
