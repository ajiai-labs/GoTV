<script lang="ts">
	// The chat of a game, in sections per move: "Partiebeginn" or "Zug 12",
	// what happened at that move (pass, end of game) and the messages.
	// Scrolling to the newest message is the parent's job, as before.
	import type { GameChatSection, Index, User } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import ChatMessages from '#lib/ui/chat/ChatMessages.svelte';
	import { formatChatActionDe } from './gameText.ts';

	let {
		currentUser,
		chatSections,
		usersByName,
		onUserDetail,
		onOpenTv
	}: {
		// Defaults (ChatMessages): the signed-in user, the known users, the
		// app's user details and its stream opener.
		currentUser?: User | null;
		chatSections: Array<GameChatSection>;
		usersByName?: Index<User>;
		onUserDetail?: (name: string) => unknown;
		onOpenTv?: (url: string) => unknown;
	} = $props();
</script>

<div class="GameChat">
	{#each chatSections as section (section.nodeId)}
		<section class="GameChat-section">
			<h3 class="GameChat-section-title">
				{section.moveNum === 0 ? t('game.chat.start') : t('game.move', { move: section.moveNum })}
			</h3>
			{#if section.actions.length}
				<ul class="GameChat-section-actions">
					{#each section.actions as action (action)}
						<li class="GameChat-section-actions-item">{formatChatActionDe(action)}</li>
					{/each}
				</ul>
			{/if}
			{#if section.messages?.length}
				<div class="GameChat-section-messages">
					<ChatMessages
						{currentUser}
						messages={section.messages}
						{usersByName}
						{onUserDetail}
						{onOpenTv}
					/>
				</div>
			{/if}
		</section>
	{/each}
</div>

<style>
	.GameChat-section {
		padding: 4px 0 8px;
	}

	.GameChat-section-title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0 4px;
		font-size: 0.8em;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.GameChat-section-title::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--rule);
	}

	.GameChat-section-actions {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.GameChat-section-actions-item {
		padding: 2px 0;
		font-style: italic;
		color: var(--ink-soft);
	}

	/* The move title says when; the message time would repeat it. */
	.GameChat-section-messages :global(.ChatMessages-item-time) {
		display: none;
	}

	:global([data-design='oldschool']) .GameChat-section-title {
		text-transform: none;
		letter-spacing: 0;
		color: var(--accent);
	}
</style>
