<script lang="ts" module>
	import type { User } from '#lib/model/types.ts';
	import { language, locale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	const STATUS: Record<string, MessageKey> = {
		Idle: 'chat.profile.status.idle',
		Playing: 'chat.profile.status.playing',
		Online: 'chat.profile.status.online',
		Offline: 'chat.profile.status.offline'
	};

	const AUTH_NAME: Record<string, MessageKey> = {
		jr_admin: 'chat.profile.auth.jrAdmin',
		sr_admin: 'chat.profile.auth.srAdmin',
		super_admin: 'chat.profile.auth.superAdmin',
		teacher: 'chat.profile.auth.teacher'
	};

	export function authName(user: User): string | null {
		const key = user.authLevel ? AUTH_NAME[user.authLevel] : undefined;
		return key ? t(key) : null;
	}

	const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
		['minute', 60 * 60],
		['hour', 60 * 60 * 24],
		['day', 60 * 60 * 24 * 7],
		['week', 60 * 60 * 24 * 30],
		['month', 60 * 60 * 24 * 365],
		['year', Infinity]
	];
	const UNIT_SECONDS: Record<string, number> = {
		minute: 60,
		hour: 60 * 60,
		day: 60 * 60 * 24,
		week: 60 * 60 * 24 * 7,
		month: 60 * 60 * 24 * 30,
		year: 60 * 60 * 24 * 365
	};

	// "vor 3 Tagen" / "3 days ago", with the same steps as timeAgo in util/date.
	export function timeAgo(date: Date, now = Date.now()): string {
		const diff = (date.valueOf() - now) / 1000;
		const seconds = Math.abs(diff);
		if (seconds < 60) return t('chat.profile.justNow');
		const [unit] = UNITS.find(([, below]) => seconds < below) ?? UNITS[UNITS.length - 1];
		const relative = new Intl.RelativeTimeFormat(language.current, { numeric: 'auto' });
		return relative.format(Math.sign(diff) * Math.round(seconds / UNIT_SECONDS[unit]), unit);
	}

	// "en_US" -> "Englisch / USA" ("English / USA")
	export function localeText(userLocale: string | undefined): string | null {
		if (!userLocale) return null;
		try {
			const parsed = new Intl.Locale(userLocale.replace('_', '-'));
			const names = [locale()];
			const name = new Intl.DisplayNames(names, { type: 'language' }).of(parsed.language);
			const region = parsed.region
				? new Intl.DisplayNames(names, { type: 'region' }).of(parsed.region)
				: null;
			if (!name) return null;
			return region
				? `${name} / ${region.replace('Vereinigte Staaten', 'USA').replace('United States', 'USA')}`
				: name;
		} catch {
			return null;
		}
	}
</script>

<script lang="ts">
	// A KGS user's profile, opened from any user name (app.state.userDetailsRequest):
	// status, avatar, real name, joined, language, e-mail, bio, rank graph and
	// the game archive. Games being played open directly, finished ones can be
	// loaded into a room. Others get "Nachricht senden", you get "Profil
	// bearbeiten".
	import { app } from '#lib/app.svelte.ts';
	import { bringToBoards } from '#lib/gameWindows.ts';
	import { findRunningGames } from '#lib/model/team.ts';
	import type { GameSummary, Room, UserDetails } from '#lib/model/types.ts';
	import { getUserStatusText } from '#lib/model/user.ts';
	import { formatLocaleDate } from '#lib/util/date.ts';
	import Modal from '#lib/ui/Modal.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import RichContent from '#lib/ui/RichContent.svelte';
	import UserName from '#lib/ui/UserName.svelte';
	import GameSummaryList from '#lib/ui/game/GameSummaryList.svelte';
	import UserAvatar from './UserAvatar.svelte';
	import UserDetailsEditForm from './UserDetailsEditForm.svelte';
	import UserGameSummary from './UserGameSummary.svelte';
	import UserRankGraph from './UserRankGraph.svelte';
	import { followed } from './followed.svelte.ts';
	import LeaveMessageForm from '#lib/ui/community/LeaveMessageForm.svelte';
	import { isOnList } from '#lib/model/community.ts';
	import type { FriendType } from '#lib/model/community.ts';

	// The KGS lists as toggles in a profile: Freund, Ignorieren, Fan.
	const LIST_BUTTONS: Array<{ type: FriendType; off: MessageKey; on: MessageKey }> = [
		{ type: 'buddy', off: 'community.profile.addBuddy', on: 'community.profile.isBuddy' },
		{ type: 'fan', off: 'community.profile.addFan', on: 'community.profile.isFan' },
		{ type: 'censored', off: 'community.profile.addCensored', on: 'community.profile.isCensored' }
	];

	const MAX_GAME_SUMMARIES = 500;

	type Tab = 'bio' | 'games' | 'rankGraph';

	let tab = $state<Tab>('bio');
	let editing = $state(false);
	let leavingMessage = $state(false);
	let gameToLoad: GameSummary | null = $state(null);

	let appState = $derived(app.state);
	let request = $derived(appState.userDetailsRequest);
	let currentUser = $derived(appState.currentUser);
	let user = $derived(request ? appState.usersByName[request.name] : undefined);
	let details = $derived(user?.details);
	let gameSummaries = $derived(request ? appState.gameSummariesByUser[request.name] : undefined);
	let channelId = $derived(details?.channelId);
	let offline = $derived(!!user && !user.flags?.connected);
	let isMe = $derived(!!user && !!currentUser && user.name === currentUser.name);
	let bio = $derived(details?.personalInfo ? details.personalInfo.trim() : '');
	let shownTab = $derived<Tab>(tab === 'bio' && !bio ? 'games' : tab);
	let realName = $derived(
		details?.personalName && details.personalName !== user?.name ? details.personalName : null
	);

	// A game the player is playing right now: watch it, or bring it to the
	// Brettübersicht (e.g. a team mate's game in a team match).
	let runningGames = $derived(user ? findRunningGames(appState.activeGames, user.name) : []);
	let boardsNote: string | null = $state(null);
	function toBoards(gameId: number) {
		const result = bringToBoards(gameId, (id) => !!app.state.gamesById[id]);
		boardsNote =
			result === 'full'
				? t('app.boards.full')
				: result === 'refused'
					? t('game.screen.ownWindowRefused')
					: null;
	}

	let statusText = $derived.by(() => {
		if (!user) return null;
		const key = STATUS[getUserStatusText(user)];
		const status = key ? t(key) : getUserStatusText(user);
		return offline && user.details
			? t('chat.profile.lastOnline', {
					status,
					ago: timeAgo(new Date(user.details.lastOn))
				})
			: status;
	});

	let rooms = $derived(
		Object.keys(appState.conversationsById)
			.map((id) => appState.roomsById[id])
			.filter((room): room is Room => !!room)
	);

	function close() {
		app.actions.onCloseUserDetail();
	}

	function showRankGraph() {
		app.actions.onRequestRankGraph(Number(channelId));
		tab = 'rankGraph';
	}

	function selectGame(game: GameSummary) {
		if (game.inPlay) {
			app.actions.onCloseUserDetail();
			if (game.type === 'review' && appState.reviewGameId) {
				app.actions.onJoinGame(appState.reviewGameId);
			} else {
				app.actions.onJoinGame(game.timestamp);
			}
		} else {
			gameToLoad = game;
		}
	}

	function saveDetails(changedUser: User, changed: UserDetails, newPassword: string) {
		app.actions.onUpdateProfileDetails(changedUser, changed);
		if (newPassword) app.actions.onUpdatePassword(changedUser, newPassword);
		editing = false;
	}
</script>

{#if request}
	{#if editing && user && details}
		<Modal title={t('chat.profile.edit')} onclose={() => (editing = false)}>
			<UserDetailsEditForm
				{user}
				{details}
				onSave={saveDetails}
				onCancel={() => (editing = false)}
			/>
		</Modal>
	{:else if gameToLoad}
		<Modal title={t('chat.profile.archiveGame')} onclose={() => (gameToLoad = null)}>
			<UserGameSummary
				activeConversationId={appState.activeConversationId}
				game={gameToLoad}
				onLoadGame={app.actions.onLoadGame}
				onCloseUserDetail={app.actions.onCloseUserDetail}
				onJoinGame={app.actions.onJoinGame}
				onLeaveGame={app.actions.onLeaveGame}
				reviewGameId={appState.reviewGameId}
				{rooms}
				loadFailed={appState.loadFailed != null}
				onOpenReplay={(gameId: number) => app.openArchiveReplay(gameId)}
			/>
		</Modal>
	{:else}
		<Modal
			title={t('chat.profile.title')}
			wide
			onclose={() => {
				// Switching to the edit form or a game closes this dialog too.
				if (!editing && !gameToLoad) close();
			}}
		>
			<div class="UserDetailsModal">
				<div class="top">
					<div class="avatar"><UserAvatar {user} /></div>
					<div class="who">
						<div class="name">
							{#if user}<UserName {user} extraIcons />{:else}{request.name}{/if}
						</div>
						{#if realName}<div class="realname">{realName}</div>{/if}
						{#if user && authName(user)}<div class="authname">{authName(user)}</div>{/if}
						{#if statusText}
							<div class="status muted" class:online={!offline}>{statusText}</div>
						{/if}
					</div>
					{#if user}
						<div class="actions">
							{#if !isMe && user.flags?.connected}
								<button
									class="button button-primary"
									type="button"
									onclick={() => user && app.actions.onStartChat(user)}
								>
									{t('chat.profile.sendMessage')}
								</button>
							{:else if isMe}
								<button class="button" type="button" onclick={() => (editing = true)}>
									{t('chat.profile.edit')}
								</button>
							{/if}
							{#if !isMe}
								<button
									class="button"
									type="button"
									aria-pressed={followed.has(user.name)}
									onclick={() => user && followed.toggle(user.name)}
								>
									{followed.has(user.name) ? t('chat.profile.following') : t('chat.profile.follow')}
								</button>
								{#if !user.flags?.connected}
									<button class="button" type="button" onclick={() => (leavingMessage = true)}>
										{t('community.profile.leaveMessage')}
									</button>
								{/if}
							{/if}
						</div>
					{/if}
				</div>

				{#if runningGames.length && !isMe}
					<div class="running">
						{#each runningGames as game (game.id)}
							<p>
								{t('app.boards.playingNow', {
									white: game.players?.white?.name ?? '?',
									black: game.players?.black?.name ?? '?',
									move: String(game.moveNum ?? 0)
								})}
							</p>
							<div class="running-actions">
								<button type="button" class="button" onclick={() => app.watchGame(game.id)}>
									{t('app.boards.watch')}
								</button>
								<button type="button" class="button" onclick={() => toBoards(game.id)}>
									{t('app.boards.add')}
								</button>
							</div>
						{/each}
						{#if boardsNote}<p class="muted" role="status">{boardsNote}</p>{/if}
					</div>
				{/if}

				{#if user && !isMe}
					{@const name = user.name}
					<div class="lists" role="group" aria-label={t('community.profile.lists')}>
						{#each LIST_BUTTONS as item (item.type)}
							{@const on = isOnList(app.state.friends, item.type, name)}
							<button
								class="button"
								type="button"
								aria-pressed={on}
								onclick={() =>
									on
										? app.actions.onRemoveFriend(item.type, name)
										: app.actions.onAddFriend(item.type, name)}
							>
								{t(on ? item.on : item.off)}
							</button>
						{/each}
					</div>
				{/if}

				{#if user && details}
					{@const userLocale = localeText(details.locale)}
					<ul class="facts">
						<li>
							{t('chat.profile.memberSince', {
								date: formatLocaleDate(new Date(details.regStartDate))
							})}
						</li>
						{#if userLocale}<li>{userLocale}</li>{/if}
						{#if details.email && !details.privateEmail}
							<li><a href="mailto:{details.email}">{details.email}</a></li>
						{/if}
					</ul>

					{#if bio || gameSummaries}
						<div class="tabs" role="tablist" aria-label={t('chat.profile.tabs')}>
							{#if bio}
								<button
									type="button"
									role="tab"
									aria-selected={shownTab === 'bio'}
									onclick={() => (tab = 'bio')}
								>
									{t('chat.edit.about')}
								</button>
							{/if}
							{#if gameSummaries}
								<button
									type="button"
									role="tab"
									aria-selected={shownTab === 'games'}
									onclick={() => (tab = 'games')}
								>
									{t('chat.roomGames.games', { count: gameSummaries.length })}
								</button>
							{/if}
							<button
								type="button"
								role="tab"
								aria-selected={shownTab === 'rankGraph'}
								onclick={showRankGraph}
							>
								{t('chat.profile.rank')}
							</button>
						</div>
						<div class="tab-content" role="tabpanel">
							{#if bio && shownTab === 'bio'}
								<div class="bio"><RichContent content={bio} /></div>
							{:else if gameSummaries && shownTab === 'games'}
								{#if gameSummaries.length}
									<div class="games">
										<GameSummaryList
											games={gameSummaries.slice(0, MAX_GAME_SUMMARIES)}
											player={user.name}
											onSelect={selectGame}
										/>
									</div>
								{:else}
									<p class="muted">{t('chat.profile.noGames')}</p>
								{/if}
							{:else if shownTab === 'rankGraph'}
								<UserRankGraph
									graph={channelId ? appState.rankGraphsByChannelId[channelId] : null}
								/>
							{/if}
						</div>
					{/if}
				{:else if user || request.status === 'pending'}
					<Spinner label={t('chat.profile.loading')} />
				{:else}
					<p class="not-found">{t('chat.profile.notFound', { name: request.name })}</p>
				{/if}
			</div>
		</Modal>
	{/if}
{/if}

{#if leavingMessage && user}
	<Modal title={t('community.message.title')} onclose={() => (leavingMessage = false)}>
		<LeaveMessageForm to={user.name} />
	</Modal>
{/if}

<style>
	.lists {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 12px;
	}

	.UserDetailsModal {
		padding-top: 8px;
	}

	.top {
		display: grid;
		grid-template-columns: 72px 1fr auto;
		gap: 14px;
		align-items: center;
	}

	.avatar {
		width: 72px;
		height: 72px;
	}

	.who {
		min-width: 0;
	}

	.name {
		font-size: 1.3rem;
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.realname {
		font-weight: 550;
	}

	.authname {
		color: var(--accent);
		font-size: 0.9em;
	}

	.running {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 10px 0 4px;
	}

	.running p {
		margin: 0;
	}

	.running-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.status {
		font-size: 0.9em;
	}

	.status.online::before {
		content: '';
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 6px;
		border-radius: 50%;
		background: var(--live);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
		margin: 14px 0 0;
		padding: 0;
		list-style: none;
		color: var(--ink-soft);
		font-size: 0.92em;
	}

	.facts a {
		overflow-wrap: anywhere;
	}

	.tabs {
		display: flex;
		gap: 4px;
		margin-top: 16px;
		border-bottom: 1px solid var(--rule);
		overflow-x: auto;
	}

	.tabs button {
		min-height: 36px;
		padding: 6px 14px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
		white-space: nowrap;
	}

	.tabs button[aria-selected='true'] {
		border-bottom-color: var(--accent);
		color: var(--ink);
		font-weight: 600;
	}

	.tab-content {
		padding-top: 12px;
		max-height: min(52dvh, 480px);
		overflow-y: auto;
	}

	.bio {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.not-found {
		margin: 20px 0 8px;
	}

	:global([data-design='oldschool']) .tabs {
		gap: 2px;
		border-bottom: 2px solid #808080;
	}

	:global([data-design='oldschool']) .tabs button {
		min-height: 24px;
		padding: 2px 10px;
		border: 2px outset #ece9e2;
		border-bottom: 0;
		background: var(--surface);
		color: var(--ink);
	}

	:global([data-design='oldschool']) .tabs button[aria-selected='true'] {
		background: var(--surface-sunk);
		font-weight: 700;
	}

	:global([data-design='oldschool']) .avatar {
		border: 2px inset #ece9e2;
	}

	@media (max-width: 520px) {
		.top {
			grid-template-columns: 56px 1fr;
		}

		.avatar {
			width: 56px;
			height: 56px;
		}

		.actions {
			grid-column: 1 / -1;
		}
	}
</style>
