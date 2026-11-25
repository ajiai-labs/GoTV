<script lang="ts">
	// A private chat with one KGS user: status, "Profil ansehen", the messages
	// and the input line. Keeps the newest message in view.
	import { app } from '#lib/app.svelte.ts';
	import type { Conversation, Index, User } from '#lib/model/types.ts';
	import UserName from '#lib/ui/UserName.svelte';
	import ChatMessages from './ChatMessages.svelte';
	import ChatMessageBar from './ChatMessageBar.svelte';
	import { keepNewestInView } from './keepNewestInView.svelte.ts';
	import { userStatusText } from './userStatus.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		user,
		conversation,
		currentUser,
		usersByName,
		onUserDetail,
		onSendChat
	}: {
		user: User;
		conversation: Conversation;
		// Defaults (as in ChatMessages): the app's user, users and user details.
		currentUser?: User | null;
		usersByName?: Index<User>;
		onUserDetail?: (name: string) => unknown;
		onSendChat: (body: string) => unknown;
	} = $props();

	function showProfile(name: string) {
		if (onUserDetail) onUserDetail(name);
		else app.actions.onUserDetail(name);
	}

	let disabled = $derived(!!conversation.chatsDisabled || !!(user.flags && !user.flags.connected));
</script>

<div class="UserChat">
	<div class="UserChat-head">
		<div class="UserChat-info">
			{#if conversation.declinedByOther}
				<span class="muted">{t('community.noChats.otherDeclined', { name: user.name })}</span>
			{:else if disabled}
				<span class="muted">{t('chat.disabled')}</span>
			{:else}
				<UserName {user} extraIcons />
				<span class="muted">· {userStatusText(user)}</span>
			{/if}
		</div>
		<span class="UserChat-buttons">
			<button type="button" class="button" onclick={() => showProfile(user.name)}>
				{t('chat.user.viewProfile')}
			</button>
			<button
				type="button"
				class="button"
				onclick={() => app.actions.onDeclineConversation(conversation.id)}
			>
				{t('community.noChats.stop')}
			</button>
		</span>
	</div>
	<div
		class="UserChat-messages"
		{@attach keepNewestInView(() => [conversation.id, conversation.messages.length])}
	>
		<ChatMessages {currentUser} messages={conversation.messages} {usersByName} {onUserDetail} />
	</div>
	<div class="UserChat-message-bar">
		<ChatMessageBar {conversation} onSubmit={onSendChat} />
	</div>
</div>

<style>
	.UserChat-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.UserChat {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.UserChat-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--rule);
	}

	.UserChat-info {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.UserChat-messages {
		flex: 1;
		min-height: 0;
		padding: 16px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.UserChat-message-bar {
		padding: 10px 12px;
		border-top: 1px solid var(--rule);
	}

	/* On phones the page's banner shows name and status (as before). */
	@media (max-width: 736px) {
		.UserChat-head {
			display: none;
		}

		.UserChat-messages {
			padding: 12px 10px;
		}
	}

	:global([data-design='oldschool']) .UserChat-head {
		padding: 4px 8px;
		border-bottom: 2px solid #808080;
	}

	:global([data-design='oldschool']) .UserChat-messages {
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .UserChat-message-bar {
		padding: 4px;
	}
</style>
