<script lang="ts">
	// The messages of a chat (room, private chat, game chat). Games and
	// challenges of a room can be mixed in, sorted by time, as links. Stream
	// links (YouTube/Twitch) in a message get a button "Im TV öffnen".
	// Scrolling to the newest message is the parent's job, as before.
	import { app } from '#lib/app.svelte.ts';
	import type { ConversationMessage, GameChannel, Index, User } from '#lib/model/types.ts';
	import { formatLocaleTime } from '#lib/util/date.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { extractUrls, isStreamUrl, normalizeUrl } from '#lib/util/urls.ts';
	import RichContent from '#lib/ui/RichContent.svelte';
	import UserName from '#lib/ui/UserName.svelte';
	import GamePlayersList from '#lib/ui/game/GamePlayersList.svelte';
	import GameTimeSystem from '#lib/ui/game/GameTimeSystem.svelte';
	import GameTypeIcon from '#lib/ui/game/GameTypeIcon.svelte';

	type ChatItem =
		| { key: string; time: number; type: 'message'; message: ConversationMessage }
		| { key: string; time: number; type: 'game'; game: GameChannel };

	let {
		currentUser: currentUserProp,
		messages,
		usersByName: usersByNameProp,
		games = null,
		onUserDetail: onUserDetailProp,
		onJoinGame,
		onSelectChallenge,
		onOpenTv: onOpenTvProp
	}: {
		// Default: the signed-in user / known users of the app.
		currentUser?: User | null;
		messages: Array<ConversationMessage>;
		usersByName?: Index<User>;
		games?: Array<GameChannel> | null;
		// Default: the app's user details.
		onUserDetail?: (name: string) => unknown;
		onJoinGame?: (gameId: number | string) => unknown;
		onSelectChallenge?: (gameId: number) => unknown;
		// Default: the app opens the stream in GoTV.
		onOpenTv?: (url: string) => unknown;
	} = $props();

	let currentUser = $derived(
		currentUserProp === undefined ? app.state.currentUser : currentUserProp
	);
	let usersByName = $derived(usersByNameProp ?? app.state.usersByName);

	let items: Array<ChatItem> = $derived.by(() => {
		if (!games || !games.length) {
			return messages.map((message) => ({
				key: 'm' + message.id,
				time: 0,
				type: 'message' as const,
				message
			}));
		}
		let itemId = 1;
		const merged: Array<ChatItem> = messages.map((message) => ({
			key: 'i' + itemId++,
			time: message.date ? message.date.getTime() : 0,
			type: 'message' as const,
			message
		}));
		for (const game of games) {
			merged.push({ key: 'i' + itemId++, time: game.time || 0, type: 'game', game });
		}
		return merged.sort((a, b) => a.time - b.time);
	});

	function senderOf(message: ConversationMessage): User | string {
		// The old app noted the sender is sometimes missing.
		return usersByName[message.sender] || message.sender || t('chat.messages.unknownSender');
	}

	function senderName(sender: User | string): string {
		return typeof sender === 'string' ? sender : sender.name;
	}

	// Each stream once (the old list repeated a link posted twice).
	function streamUrlsOf(message: ConversationMessage): Array<string> {
		const urls = extractUrls(message.body).map(normalizeUrl).filter(isStreamUrl);
		return [...new Set(urls)];
	}

	function onUserDetail(sender: User | string) {
		const name = senderName(sender);
		if (onUserDetailProp) onUserDetailProp(name);
		else app.actions.onUserDetail(name);
	}

	function onOpenTv(url: string) {
		if (onOpenTvProp) onOpenTvProp(url);
		else app.actions.onOpenTvStream(url);
	}

	function onSelectGame(game: GameChannel) {
		if (game.deletedTime) return;
		if (game.type === 'challenge' && onSelectChallenge) {
			onSelectChallenge(game.id);
		} else if (onJoinGame) {
			onJoinGame(game.id);
		}
	}
</script>

<div class="ChatMessages">
	{#each items as item (item.key)}
		{#if item.type === 'message'}
			{@const message = item.message}
			{@const sender = senderOf(message)}
			{@const streamUrls = streamUrlsOf(message)}
			<div
				class="ChatMessages-item"
				class:ChatMessages-item-announcement={message.announcement}
				class:ChatMessages-item-self={!!currentUser && currentUser.name === senderName(sender)}
			>
				<div class="ChatMessages-item-content">
					{#if message.announcement}<span class="ChatMessages-item-label">
							{t('chat.messages.announcement')}
						</span>{/if}
					<button
						type="button"
						class="ChatMessages-item-user"
						class:ChatMessages-item-user-unverified={typeof sender === 'string'}
						onclick={() => onUserDetail(sender)}
					>
						{#if typeof sender === 'string'}
							{sender}
						{:else}
							<UserName user={sender} />
						{/if}
					</button>
					<div class="ChatMessages-item-body">
						<RichContent content={message.body} />
					</div>
					{#if streamUrls.length}
						<div class="ChatMessages-item-tv">
							{#each streamUrls as url (url)}
								<button
									type="button"
									class="button ChatMessages-item-tv-button"
									title={url}
									onclick={() => onOpenTv(url)}
								>
									{t('chat.messages.openInTv')}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				{#if message.date}
					<div class="ChatMessages-item-time">
						{message.sending ? t('chat.messages.sending') : formatLocaleTime(message.date)}
					</div>
				{/if}
			</div>
		{:else}
			{@const game = item.game}
			<button
				type="button"
				class="ChatMessages-game ChatMessages-game-type-{game.type}"
				class:ChatMessages-game-deleted={!!game.deletedTime}
				aria-disabled={game.deletedTime ? 'true' : undefined}
				onclick={() => onSelectGame(game)}
			>
				<span class="ChatMessages-game-icon">
					<GameTypeIcon
						type={game.initialProposal ? game.initialProposal.gameType : game.type}
						isPrivate={game.private}
						subscribersOnly={game.subscribers}
					/>
				</span>
				<span class="ChatMessages-game-players">
					<GamePlayersList players={game.players} />
				</span>
				{#if game.initialProposal?.rules}
					<span class="ChatMessages-game-time">
						<GameTimeSystem rules={game.initialProposal.rules} />
					</span>
				{/if}
				{#if game.name}
					<span class="ChatMessages-game-name">– {game.name}</span>
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.ChatMessages {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ChatMessages-item {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		max-width: 100%;
	}

	.ChatMessages-item-content {
		max-width: min(420px, 100%);
		padding: 6px 12px 7px;
		border-radius: 14px;
		background: var(--surface-sunk);
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.ChatMessages-item-self .ChatMessages-item-content {
		background: var(--accent-soft);
	}

	.ChatMessages-item-announcement .ChatMessages-item-content {
		background: var(--warn-bg, #fff3c4);
		color: var(--paper-ink, #1d2421);
	}

	.ChatMessages-item-label {
		margin-right: 6px;
		font-weight: 700;
	}

	.ChatMessages-item-user {
		display: inline;
		margin: 0 6px 0 0;
		padding: 0;
		border: 0;
		background: none;
		font-weight: 650;
		text-align: left;
		cursor: pointer;
	}

	.ChatMessages-item-user:hover {
		text-decoration: underline;
	}

	.ChatMessages-item-user-unverified {
		color: var(--ink-soft);
	}

	.ChatMessages-item-body {
		display: inline;
	}

	.ChatMessages-item-body :global(.RichContent) {
		display: inline;
	}

	.ChatMessages-item-tv {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}

	.ChatMessages-item-tv-button {
		padding: 3px 10px;
		font-size: 0.85em;
		border-color: var(--accent);
		color: var(--accent);
	}

	.ChatMessages-item-time {
		flex: none;
		padding-bottom: 4px;
		font-size: 11px;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}

	.ChatMessages-game {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 8px;
		width: 100%;
		min-height: 32px;
		margin: 2px 0;
		padding: 4px 8px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		color: var(--ink-soft);
		font-size: 0.93em;
		text-align: left;
		cursor: pointer;
	}

	.ChatMessages-game:hover {
		background: var(--surface-sunk);
	}

	.ChatMessages-game-type-challenge .ChatMessages-game-players {
		font-weight: 650;
		color: var(--ink);
	}

	.ChatMessages-game-deleted {
		opacity: 0.35;
		cursor: default;
	}

	.ChatMessages-game-deleted:hover {
		background: none;
	}

	/* The players in one line: "A gegen B" (rengo partners after a space). */
	.ChatMessages-game-players :global(.GamePlayersList) {
		display: flex;
		flex-wrap: wrap;
		gap: 0 6px;
	}

	.ChatMessages-game-players :global(.GamePlayersList-player2)::before {
		content: 'gegen ';
	}

	:global([data-design='oldschool']) .ChatMessages-item-content {
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .ChatMessages-item-self .ChatMessages-item-content {
		background: var(--accent-soft);
	}
</style>
