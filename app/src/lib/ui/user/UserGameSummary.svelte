<script lang="ts">
	// A finished game from a user's archive: players, result, date, type, and
	// the form to load it into one of your rooms (KGS opens it there as a
	// review). When KGS reports the new review, it is joined and the user
	// details close.
	import { untrack } from 'svelte';
	import type { GameChannel, GameSummary, Room } from '#lib/model/types.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import { formatGameTypeDe, formatScoreDe } from '#lib/ui/game/gameText.ts';
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
		rooms = []
	}: {
		activeConversationId: number | null | undefined;
		game: GameSummary;
		onCloseUserDetail: () => void;
		onJoinGame: (gameId: number | string) => void;
		onLoadGame: (timestamp: string, channelId: number, privateGame: boolean) => void;
		onLeaveGame: (game: GameChannel | number) => void;
		reviewGameId: number | null | undefined;
		rooms?: Array<Room>;
	} = $props();

	const formId = $props.id();

	let privateGame = $state(true);
	let showSpinner = $state(false);
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
				// Leave the game that was being reviewed before.
				if (initialReviewGameId) onLeaveGame(initialReviewGameId);
				onJoinGame(reviewGameId);
				onCloseUserDetail();
			});
		}
	});

	// "Die Partie wird in {room} geladen.": the room name in bold.
	let loadsIn = $derived(t('chat.summary.loadsIn').split('{room}'));

	function load() {
		if (!targetRoom) return;
		showSpinner = true;
		onLoadGame(game.timestamp, targetRoom, privateGame);
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

	{#if !targetRoom}
		<p class="note"><strong>{t('chat.summary.joinRoomFirst')}</strong></p>
	{:else if showSpinner}
		<Spinner label={t('chat.summary.loading')} />
	{:else}
		<form
			class="load"
			onsubmit={(event) => {
				event.preventDefault();
				load();
			}}
		>
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
			<label class="check">
				<input type="checkbox" name="privateGame" bind:checked={privateGame} />
				<span>{t('chat.summary.private')}</span>
			</label>
			<div>
				<button class="button button-primary" type="submit">{t('chat.summary.load')}</button>
			</div>
		</form>
	{/if}
</div>

<style>
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
