<script lang="ts">
	// "Mehr" above a game: download the SGF, open it in GoKibitz or EidoGo,
	// and the full game info (size, ID, date, result and the SGF details
	// such as event, round and place) in a dialog. A click elsewhere closes
	// the menu.
	import { formatScoreDe } from './gameText.ts';
	import { getKgsSgfUrl } from '#lib/model/game/tree.ts';
	import type { GameChannel, GameNode, Index, Room, SgfProp } from '#lib/model/types.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import Modal from '#lib/ui/Modal.svelte';
	import GameInfo from './GameInfo.svelte';

	const MORE_INFO_PROPS: Record<string, string> = {
		ANNOTATOR: 'Kommentar von',
		COPYRIGHT: 'Copyright',
		EVENT: 'Veranstaltung',
		PLACE: 'Ort',
		PLAYERTEAM: 'Team',
		ROUND: 'Runde',
		SOURCE: 'Quelle',
		TRANSCRIBER: 'Mitschrift von'
	};

	let {
		game,
		roomsById
	}: {
		game: GameChannel;
		// Default: the rooms the app knows.
		roomsById?: Index<Room>;
	} = $props();

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
				const color =
					prop.color === 'black' ? ' (Schwarz)' : prop.color === 'white' ? ' (Weiß)' : '';
				return {
					key: prop.name.toLowerCase() + color,
					label: MORE_INFO_PROPS[prop.name] + color,
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
		Mehr <span aria-hidden="true">▾</span>
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
				SGF herunterladen
			</a>
			<a
				class="GameMoreMenu-dropdown-item"
				target="_blank"
				rel="noopener noreferrer"
				href={gokibitzUrl}
				onclick={() => (moreShowing = false)}
			>
				In GoKibitz öffnen
			</a>
			<a
				class="GameMoreMenu-dropdown-item"
				target="_blank"
				rel="noopener noreferrer"
				href={eidogoUrl}
				onclick={() => (moreShowing = false)}
			>
				In EidoGo öffnen
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<button type="button" class="GameMoreMenu-dropdown-item" onclick={showGameInfo}>
				Partieinfo
			</button>
		</div>
	{/if}
	{#if gameInfoShowing}
		<Modal title="Partieinfo" onclose={() => (gameInfoShowing = false)}>
			<div class="GameMoreMenu-game-info">
				<GameInfo {game} {roomsById}>
					{#if game.rules}
						<tr><th scope="row">Größe</th><td>{game.rules.size} × {game.rules.size}</td></tr>
					{/if}
					<tr><th scope="row">ID</th><td>{game.id}</td></tr>
					<tr><th scope="row">Datum</th><td>{formatLocaleDateTime(new Date(game.time))}</td></tr>
					{#if game.over && game.score}
						<tr><th scope="row">Ergebnis</th><td>{formatScoreDe(game.score)}</td></tr>
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
