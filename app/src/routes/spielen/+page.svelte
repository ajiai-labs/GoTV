<script lang="ts">
	// Spielen (old PlayScreen): open challenges of the rooms, own unfinished
	// games, creating a challenge. A selected or new challenge opens the
	// ChallengeEditor in a dialog; once the game starts (playGameId), the
	// game itself is shown here.
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { getDefaultRoom } from '#lib/model/room.ts';
	import type { GameChannel, GameFilter, GameSummary, User } from '#lib/model/types.ts';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import Modal from '#lib/ui/Modal.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import GameList from '#lib/ui/game/GameList.svelte';
	import GameListFilter from '#lib/ui/game/GameListFilter.svelte';
	import GameSummaryList from '#lib/ui/game/GameSummaryList.svelte';
	import GameScreen from '#lib/ui/game/GameScreen.svelte';
	import { isGamePlaying } from '#lib/model/game/tree.ts';
	import ChallengeEditor from '#lib/ui/game/ChallengeEditor.svelte';
	import AutomatchPanel from '#lib/ui/game/AutomatchPanel.svelte';

	let appState = $derived(app.state);
	let creatingChallenge = $state(false);

	let challenge = $derived(
		appState.playChallengeId ? appState.gamesById[appState.playChallengeId] : null
	);
	let conversation = $derived(
		appState.playChallengeId ? appState.conversationsById[appState.playChallengeId] : null
	);
	let activeGame = $derived(appState.playGameId ? appState.gamesById[appState.playGameId] : null);
	let defaultRoom = $derived(getDefaultRoom(appState.channelMembership, appState.roomsById));

	let unfinishedChannels = $derived(
		appState.unfinishedGames.flatMap((ug) => (ug.type === 'channel' ? [ug.game] : []))
	);
	let unfinishedSummaries = $derived(
		appState.unfinishedGames.flatMap((ug) => (ug.type === 'summary' ? [ug.game] : []))
	);

	onMount(() => window.scrollTo(0, 0));

	// The game started: to the top, where it is shown.
	let hadGame = false;
	$effect(() => {
		const hasGame = !!activeGame;
		if (hasGame && !hadGame) window.scrollTo(0, 0);
		hadGame = hasGame;
	});

	// The new challenge exists (or its game started): the dialog now follows
	// the app state instead of "creating".
	$effect(() => {
		if (creatingChallenge && (activeGame || appState.playChallengeId)) {
			creatingChallenge = false;
		}
	});

	function onCloseChallenge() {
		if (appState.playChallengeId) app.actions.onCloseChallenge(appState.playChallengeId);
		if (creatingChallenge) creatingChallenge = false;
	}

	function onSelectGameChannel(gameId: number) {
		app.actions.onJoinGame(gameId);
	}

	function onSelectGameSummary(game: GameSummary) {
		if (game.inPlay) {
			app.actions.onJoinGame(game.timestamp);
		} else {
			app.actions.onShowUnderConstruction();
		}
	}

	// The heading of the challenge dialog, as the old ChallengeEditor's:
	// our own challenge (new or created) or someone else's.
	function challengeTitle(game: GameChannel | null, currentUser: User) {
		const creator = game ? game.players.challengeCreator : currentUser;
		return creator && creator.name === currentUser.name
			? 'Herausforderung erstellen'
			: 'Herausforderung';
	}

	function hasProposal(game: GameChannel) {
		return !!(game.sentProposal || game.initialProposal);
	}
</script>

<svelte:head>
	<title>Spielen – GoTV</title>
</svelte:head>

<KgsGate>
	{#if appState.currentUser}
		{@const currentUser = appState.currentUser}
		{#if challenge || creatingChallenge}
			<Modal title={challengeTitle(challenge, currentUser)} onclose={onCloseChallenge}>
				{#if challenge && !hasProposal(challenge)}
					<Spinner label="Herausforderung wird geladen …" />
				{:else}
					<ChallengeEditor
						{currentUser}
						{challenge}
						usersByName={appState.usersByName}
						roomsById={appState.roomsById}
						initialRoomId={defaultRoom?.id}
						{conversation}
						preferences={appState.preferences}
						onCancel={onCloseChallenge}
					/>
				{/if}
			</Modal>
		{/if}

		{#if activeGame}
			<GameScreen
				game={activeGame}
				playing={isGamePlaying(activeGame)}
				{currentUser}
				usersByName={appState.usersByName}
				roomsById={appState.roomsById}
			/>
		{:else}
			<div class="PlayScreen">
				<header class="PlayScreen-head">
					<h1>Spielen</h1>
					<button
						type="button"
						class="button button-primary"
						onclick={() => (creatingChallenge = true)}
					>
						<span aria-hidden="true">+</span> Herausforderung erstellen
					</button>
				</header>

				<AutomatchPanel />

				{#if appState.unfinishedGames.length}
					<section class="panel" aria-labelledby="unfinished-title">
						<h2 id="unfinished-title" class="panel-title">Nicht beendete Partien</h2>
						{#if unfinishedChannels.length}
							<GameList games={unfinishedChannels} onSelect={onSelectGameChannel} />
						{/if}
						<GameSummaryList
							games={unfinishedSummaries}
							player={currentUser.name}
							onSelect={onSelectGameSummary}
						/>
					</section>
				{/if}

				<section class="panel" aria-labelledby="challenges-title">
					<h2 id="challenges-title" class="panel-title">Offene Herausforderungen</h2>
					<GameListFilter
						games={appState.challenges}
						roomsById={appState.roomsById}
						filter={appState.playFilter}
						onChange={(filter: GameFilter) => app.actions.onShowGames(filter)}
					/>
					<GameList
						games={appState.challenges}
						filter={appState.playFilter}
						roomsById={appState.roomsById}
						onSelect={(id: number) => app.actions.onSelectChallenge(id)}
					/>
				</section>
			</div>
		{/if}
	{/if}
</KgsGate>

<style>
	.PlayScreen {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		max-width: 1000px;
	}

	.PlayScreen-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
	}

	.PlayScreen-head h1 {
		margin: 0;
		font-size: 1.6rem;
	}

	.PlayScreen-head .button {
		min-height: 44px;
	}

	:global([data-design='oldschool']) .PlayScreen-head h1 {
		font-size: 1.3rem;
	}

	:global([data-design='oldschool']) .PlayScreen-head .button {
		min-height: 30px;
	}
</style>
