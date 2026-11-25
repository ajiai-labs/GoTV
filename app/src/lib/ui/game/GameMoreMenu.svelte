<script lang="ts">
	// "Mehr" above a game: download the SGF, open it in GoKibitz or EidoGo,
	// and the full game info (size, ID, date, result and the SGF details
	// such as event, round and place) in a dialog. A click elsewhere closes
	// the menu.
	import { formatScoreDe } from './gameText.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { getKgsSgfUrl } from '#lib/model/game/tree.ts';
	import type { GameChannel, GameNode, Index, Room, SgfProp } from '#lib/model/types.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import Modal from '#lib/ui/Modal.svelte';
	import GameInfo from './GameInfo.svelte';
	import { app } from '#lib/app.svelte.ts';
	import ScoreEstimateDialog from './ScoreEstimateDialog.svelte';

	const MORE_INFO_PROPS: Record<string, MessageKey> = {
		ANNOTATOR: 'game.moreMenu.annotator',
		COPYRIGHT: 'game.moreMenu.copyright',
		EVENT: 'game.moreMenu.event',
		PLACE: 'game.moreMenu.place',
		PLAYERTEAM: 'game.moreMenu.playerTeam',
		ROUND: 'game.moreMenu.round',
		SOURCE: 'game.moreMenu.source',
		TRANSCRIBER: 'game.moreMenu.transcriber'
	};

	let {
		game,
		roomsById,
		kgsTools = false
	}: {
		game: GameChannel;
		// Default: the rooms the app knows.
		roomsById?: Index<Room>;
		// A KGS game watched on Beobachten: "Lokal betrachten" and "Spiel
		// kopieren in …" (as CGoban's Optionen menu).
		kgsTools?: boolean;
	} = $props();

	let estimateShowing = $state(false);
	let copyShowing = $state(false);
	let copyRoomId: number | null = $state(null);
	let copySent = $state(false);
	// The rooms we are in - KGS copies the game into one of them.
	let joinedRooms = $derived(
		Object.keys(app.state.conversationsById)
			.map((id) => (roomsById ?? app.state.roomsById)[id])
			.filter((room): room is Room => !!room)
	);

	function openLocalCopy() {
		moreShowing = false;
		app.openLocalCopy(game);
	}

	function showCopy() {
		moreShowing = false;
		copySent = false;
		copyRoomId = joinedRooms[0]?.id ?? null;
		copyShowing = true;
	}

	function sendCopy() {
		if (copyRoomId == null) return;
		app.actions.onCloneGame(copyRoomId, game.id);
		copySent = true;
	}

	const uid = $props.id();
	let moreShowing = $state(false);
	let gameInfoShowing = $state(false);
	let menuEl: HTMLElement | undefined = $state();

	let sgfUrl = $derived(game.sgfUrl || (game.summary ? getKgsSgfUrl(game.summary) : '#'));
	let eidogoUrl = $derived('http://eidogo.com/#url:' + sgfUrl);
	let gokibitzUrl = $derived('https://gokibitz.com/fetch#' + sgfUrl);

	function moreInfoRows(root: GameNode | undefined) {
		if (!root) return [];
		return root.props
			.filter((prop) => prop.name in MORE_INFO_PROPS)
			.map((prop: SgfProp) => {
				const label = t(MORE_INFO_PROPS[prop.name]);
				return {
					key: prop.name.toLowerCase() + (prop.color ? ' ' + prop.color : ''),
					label:
						prop.color === 'black'
							? t('game.moreMenu.propBlack', { label })
							: prop.color === 'white'
								? t('game.moreMenu.propWhite', { label })
								: label,
					text: prop.text ?? ''
				};
			});
	}

	let extraRows = $derived(game.tree ? moreInfoRows(game.tree.nodes[game.tree.rootNode]) : []);

	function onDocumentClick(event: MouseEvent) {
		if (moreShowing && menuEl && !menuEl.contains(event.target as Node)) {
			moreShowing = false;
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (moreShowing && event.key === 'Escape') moreShowing = false;
	}

	function showGameInfo() {
		moreShowing = false;
		gameInfoShowing = true;
	}
</script>

<svelte:document onclick={onDocumentClick} onkeydown={onKeydown} />

<div class="GameMoreMenu" bind:this={menuEl}>
	<button
		type="button"
		class="GameMoreMenu-trigger button"
		aria-expanded={moreShowing}
		aria-controls="{uid}-menu"
		onclick={() => (moreShowing = !moreShowing)}
	>
		{t('game.more')} <span aria-hidden="true">▾</span>
	</button>
	{#if moreShowing}
		<div class="GameMoreMenu-dropdown panel" id="{uid}-menu">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- SGF files and outside viewers, not GoTV pages -->
			<a
				class="GameMoreMenu-dropdown-item"
				download
				href={sgfUrl}
				onclick={() => (moreShowing = false)}
			>
				{t('game.moreMenu.downloadSgf')}
			</a>
			<a
				class="GameMoreMenu-dropdown-item"
				target="_blank"
				rel="noopener noreferrer"
				href={gokibitzUrl}
				onclick={() => (moreShowing = false)}
			>
				{t('game.moreMenu.openGoKibitz')}
			</a>
			<a
				class="GameMoreMenu-dropdown-item"
				target="_blank"
				rel="noopener noreferrer"
				href={eidogoUrl}
				onclick={() => (moreShowing = false)}
			>
				{t('game.moreMenu.openEidoGo')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<button type="button" class="GameMoreMenu-dropdown-item" onclick={showGameInfo}>
				{t('game.moreMenu.gameInfo')}
			</button>
			{#if kgsTools && game.tree}
				<button
					type="button"
					class="GameMoreMenu-dropdown-item"
					onclick={() => {
						moreShowing = false;
						estimateShowing = true;
					}}
				>
					{t('game.estimate.title')}
				</button>
				<button type="button" class="GameMoreMenu-dropdown-item" onclick={openLocalCopy}>
					{t('game.moreMenu.localCopy')}
				</button>
				<button type="button" class="GameMoreMenu-dropdown-item" onclick={showCopy}>
					{t('game.moreMenu.copyToRoom')}
				</button>
			{/if}
		</div>
	{/if}
	{#if estimateShowing}
		<ScoreEstimateDialog {game} onclose={() => (estimateShowing = false)} />
	{/if}
	{#if copyShowing}
		<Modal title={t('game.moreMenu.copyToRoom')} onclose={() => (copyShowing = false)}>
			{#if joinedRooms.length === 0}
				<p class="GameMoreMenu-copy-text">{t('game.moreMenu.copyNoRoom')}</p>
			{:else if copySent}
				<p class="GameMoreMenu-copy-text" role="status">{t('game.moreMenu.copySent')}</p>
			{:else}
				<p class="GameMoreMenu-copy-text">{t('game.moreMenu.copyText')}</p>
				<fieldset class="GameMoreMenu-copy-rooms">
					<legend>{t('game.moreMenu.copyRoom')}</legend>
					{#each joinedRooms as room (room.id)}
						<label>
							<input
								type="radio"
								name="{uid}-copy-room"
								value={room.id}
								checked={copyRoomId === room.id}
								onchange={() => (copyRoomId = room.id)}
							/>
							{room.name ?? room.id}
						</label>
					{/each}
				</fieldset>
				<button type="button" class="button button-primary" onclick={sendCopy}>
					{t('game.moreMenu.copySend')}
				</button>
			{/if}
		</Modal>
	{/if}
	{#if gameInfoShowing}
		<Modal title={t('game.moreMenu.gameInfo')} onclose={() => (gameInfoShowing = false)}>
			<div class="GameMoreMenu-game-info">
				<GameInfo {game} {roomsById}>
					{#if game.rules}
						<tr>
							<th scope="row">{t('game.moreMenu.size')}</th><td>
								{game.rules.size} × {game.rules.size}
							</td>
						</tr>
					{/if}
					<tr><th scope="row">{t('game.moreMenu.id')}</th><td>{game.id}</td></tr>
					<tr>
						<th scope="row">{t('game.moreMenu.date')}</th><td>
							{formatLocaleDateTime(new Date(game.time))}
						</td>
					</tr>
					{#if game.over && game.score}
						<tr>
							<th scope="row">{t('game.moreMenu.result')}</th><td>{formatScoreDe(game.score)}</td>
						</tr>
					{/if}
					{#each extraRows as row (row.key)}
						<tr><th scope="row">{row.label}</th><td>{row.text}</td></tr>
					{/each}
				</GameInfo>
			</div>
		</Modal>
	{/if}
</div>

<style>
	.GameMoreMenu-copy-text {
		margin: 0 0 12px;
		max-width: 46ch;
	}

	.GameMoreMenu-copy-rooms {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0 0 12px;
		border: 0;
		padding: 0;
	}

	.GameMoreMenu {
		position: relative;
	}

	.GameMoreMenu-dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 20;
		display: flex;
		flex-direction: column;
		min-width: 13rem;
		padding: 6px;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
	}

	.GameMoreMenu-dropdown-item {
		display: block;
		width: 100%;
		min-height: 40px;
		padding: 9px 12px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.GameMoreMenu-dropdown-item:hover {
		background: var(--accent-soft);
	}

	.GameMoreMenu-game-info {
		min-width: min(26rem, 80vw);
	}

	:global([data-design='oldschool']) .GameMoreMenu-dropdown {
		padding: 2px;
		box-shadow: 2px 2px 0 #000;
	}

	:global([data-design='oldschool']) .GameMoreMenu-dropdown-item {
		min-height: 0;
		padding: 3px 8px;
	}

	:global([data-design='oldschool']) .GameMoreMenu-dropdown-item:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
