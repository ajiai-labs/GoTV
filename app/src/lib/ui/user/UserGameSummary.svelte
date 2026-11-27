<script lang="ts">
	// A finished game from a user's archive: players, result, date, type, and
	// the form to load it into one of your rooms (KGS opens it there as a
	// review). When KGS reports the new review, it is joined and the user
	// details close - or, with "In GoTV nachspielen", it opens on Nachspielen.
	// `resume`: our own unfinished game; loading it lets it go on (KGS opens
	// it in the room, AppActions.onLoadedGameJoined shows it on Spielen).
	import { untrack } from 'svelte';
	import type { GameChannel, GameSummary, Room } from '#lib/model/types.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import { formatGameTypeDe, formatScoreDe } from '#lib/ui/game/gameText.ts';
	import { getKgsSgfUrl } from '#lib/model/game/tree.ts';
	import { TAG_MAX_LENGTH } from '#lib/model/tags.ts';
	import Spinner from '#lib/ui/Spinner.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		activeConversationId,
		game,
		onCloseUserDetail,
		onJoinGame,
		onLoadGame,
		onLeaveGame,
		reviewGameId,
		rooms = [],
		resume = false,
		loadFailed = false,
		onOpenReplay,
		tag = '',
		onTag
	}: {
		activeConversationId: number | null | undefined;
		game: GameSummary;
		onCloseUserDetail: () => void;
		onJoinGame: (gameId: number | string) => void;
		onLoadGame: (timestamp: string, channelId: number, privateGame: boolean) => void;
		onLeaveGame: (game: GameChannel | number) => void;
		reviewGameId: number | null | undefined;
		rooms?: Array<Room>;
		resume?: boolean;
		loadFailed?: boolean;
		onOpenReplay?: (gameId: number) => void;
		// "Spiel kommentieren": our comment on this game (KGS tag).
		tag?: string;
		onTag?: (game: GameSummary, text: string) => void;
	} = $props();

	let tagText = $state(untrack(() => tag));
	let tagSaved = $state(false);
	$effect(() => {
		tagText = tag;
	});

	const formId = $props.id();

	let privateGame = $state(untrack(() => !resume));
	let showSpinner = $state(false);
	// What the loaded review is for: KGS's review ("Partie laden") or GoTV's
	// Nachspielen ("In GoTV nachspielen").
	let target: 'kgs' | 'replay' = 'kgs';
	// The room open in the chat, else the first room you are in. (The old app
	// also took an open private conversation here, which KGS cannot load into.)
	let targetRoom: number | null | undefined = $state(
		untrack(() =>
			rooms.some((room) => room.id === activeConversationId)
				? activeConversationId
				: rooms.length
					? rooms[0].id
					: null
		)
	);
	// The review loaded when this opened; a different one is "ours".
	const initialReviewGameId = untrack(() => reviewGameId);

	$effect(() => {
		if (reviewGameId && reviewGameId !== initialReviewGameId) {
			untrack(() => {
				if (target === 'replay' && onOpenReplay) {
					onCloseUserDetail();
					onOpenReplay(reviewGameId);
					return;
				}
				// Leave the game that was being reviewed before.
				if (initialReviewGameId) onLeaveGame(initialReviewGameId);
				onJoinGame(reviewGameId);
				onCloseUserDetail();
			});
		}
	});

	// "Spiel auf Festplatte kopieren" (CGoban): the SGF from KGS's public
	// archive - only finished games that are not private are there.
	let sgfUrl = $derived.by(() => {
		if (!game.score || game.score === 'UNFINISHED' || game.private) return null;
		try {
			return getKgsSgfUrl(game);
		} catch {
			return null;
		}
	});

	// "Die Partie wird in {room} geladen.": the room name in bold.
	let loadsIn = $derived(t('chat.summary.loadsIn').split('{room}'));

	function load(to: 'kgs' | 'replay') {
		if (!targetRoom) return;
		target = to;
		showSpinner = true;
		// Only for GoTV: nobody else needs to see the review.
		onLoadGame(game.timestamp, targetRoom, to === 'replay' ? true : privateGame);
	}
</script>

<div class="UserGameSummary">
	<dl>
		<dt>{t('chat.summary.white')}</dt>
		<dd>{game.players.white?.name}</dd>
		<dt>{t('chat.summary.black')}</dt>
		<dd>{game.players.black?.name}</dd>
		{#if game.score}
			<dt>{t('chat.summary.result')}</dt>
			<dd>{formatScoreDe(game.score)}</dd>
		{/if}
		<dt>{t('chat.summary.date')}</dt>
		<dd>{formatLocaleDateTime(game.timestamp)}</dd>
		<dt>{t('chat.summary.type')}</dt>
		<dd>{formatGameTypeDe(game.type)}</dd>
	</dl>

	{#if sgfUrl}
		<p class="download">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- a file in KGS's archive, outside GoTV -->
			<a class="button" href={sgfUrl} target="_blank" rel="noopener noreferrer">
				{t('chat.summary.downloadSgf')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	{/if}
	{#if onTag}
		<form
			class="tag"
			onsubmit={(event) => {
				event.preventDefault();
				onTag(game, tagText);
				tagSaved = true;
			}}
		>
			<label for="{formId}-tag">{t('chat.summary.tag')}</label>
			<div class="tag-row">
				<input
					id="{formId}-tag"
					type="text"
					maxlength={TAG_MAX_LENGTH}
					bind:value={tagText}
					oninput={() => (tagSaved = false)}
				/>
				<button class="button" type="submit">{t('chat.summary.tagSave')}</button>
			</div>
			{#if tagSaved}<p class="muted" role="status">{t('chat.summary.tagSaved')}</p>{/if}
		</form>
	{/if}
	{#if !targetRoom}
		<p class="note"><strong>{t('chat.summary.joinRoomFirst')}</strong></p>
	{:else if showSpinner && loadFailed}
		<p class="note" role="alert">{t('chat.summary.loadFailed')}</p>
		<div>
			<button class="button" type="button" onclick={() => (showSpinner = false)}>
				{t('chat.summary.retry')}
			</button>
		</div>
	{:else if showSpinner}
		<Spinner label={t('chat.summary.loading')} />
	{:else}
		<form
			class="load"
			onsubmit={(event) => {
				event.preventDefault();
				load('kgs');
			}}
		>
			{#if resume}
				<p>{t('chat.summary.resumeHint')}</p>
			{:else if onOpenReplay}
				<div class="replay">
					<button class="button button-primary" type="button" onclick={() => load('replay')}>
						{t('chat.summary.replay')}
					</button>
					<p class="muted">{t('chat.summary.replayHint')}</p>
				</div>
			{/if}
			{#if rooms.length > 1}
				<label class="room" for="{formId}-room">{t('chat.summary.loadInto')}</label>
				<select id="{formId}-room" name="rooms" bind:value={targetRoom}>
					{#each rooms as room (room.id)}
						<option value={room.id}>{room.name}</option>
					{/each}
				</select>
			{:else if rooms.length === 1}
				<p>{loadsIn[0]}<strong>{rooms[0].name}</strong>{loadsIn[1]}</p>
			{/if}
			{#if !resume}
				<label class="check">
					<input type="checkbox" name="privateGame" bind:checked={privateGame} />
					<span>{t('chat.summary.private')}</span>
				</label>
			{/if}
			<div>
				<button class="button" class:button-primary={resume || !onOpenReplay} type="submit">
					{resume ? t('chat.summary.resume') : t('chat.summary.load')}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.download {
		margin: 0 0 12px;
	}

	.tag {
		margin: 0 0 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--rule);
	}

	.tag label {
		display: block;
		margin-bottom: 6px;
	}

	.tag-row {
		display: flex;
		gap: 8px;
	}

	.tag-row input {
		flex: 1;
		min-width: 0;
	}

	.tag .muted {
		margin: 6px 0 0;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 16px;
		margin: 8px 0 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--rule);
	}

	dt {
		color: var(--ink-soft);
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.load {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}

	.load p,
	.note {
		margin: 0;
	}

	.replay {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-bottom: 10px;
		margin-bottom: 2px;
		border-bottom: 1px solid var(--rule);
		align-self: stretch;
	}

	select {
		font: inherit;
		max-width: 100%;
		padding: 7px 10px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}

	.check input {
		width: 18px;
		height: 18px;
	}

	:global([data-design='oldschool']) .UserGameSummary select {
		padding: 2px 4px;
		border: 2px inset #ece9e2;
		background: var(--surface-sunk);
	}
</style>
