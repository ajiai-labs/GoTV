<script lang="ts">
	// The buttons of a game you play: pass (only on your move; while scoring
	// "Fertig" instead), ask to take back a move, resign, and under "Mehr"
	// give the opponent time or leave the game. Resigning asks once more (new
	// in GoTV - the old app resigned on the first tap, easy to hit on a tablet).
	import { getGamePlayerOtherRole } from '#lib/model/game/tree.ts';
	import type { GameChannel, GameRole, User } from '#lib/model/types.ts';

	const ONE_MINUTE = 60;

	let confirmingResign = $state(false);
	const FIVE_MINUTES = 5 * 60;

	let {
		currentUser,
		game,
		isOurMove,
		scoring,
		onPass,
		onUndo,
		onResign,
		onLeaveGame,
		onAddTime,
		onDoneScoring
	}: {
		currentUser: User;
		game: GameChannel;
		isOurMove: boolean;
		scoring: boolean;
		onPass: (game: GameChannel) => unknown;
		onUndo: (game: GameChannel) => unknown;
		onResign: (game: GameChannel) => unknown;
		onLeaveGame: () => unknown;
		onAddTime: (game: GameChannel, role: GameRole, seconds: number) => unknown;
		onDoneScoring: (game: GameChannel) => unknown;
	} = $props();

	const uid = $props.id();
	let moreShowing = $state(false);
	let moreEl: HTMLElement | undefined = $state();

	function onDocumentClick(event: MouseEvent) {
		if (moreShowing && moreEl && !moreEl.contains(event.target as Node)) {
			moreShowing = false;
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (moreShowing && event.key === 'Escape') moreShowing = false;
	}

	function pass() {
		if (isOurMove) onPass(game);
	}

	function addTime(seconds: number) {
		moreShowing = false;
		const otherRole = getGamePlayerOtherRole(currentUser.name, game.players);
		if (otherRole) onAddTime(game, otherRole, seconds);
	}

	function leave() {
		moreShowing = false;
		onLeaveGame();
	}
</script>

<svelte:document onclick={onDocumentClick} onkeydown={onKeydown} />

<div class="GamePlayActions" role="group" aria-label="Partie">
	{#if scoring}
		<button
			type="button"
			class="button button-primary GamePlayActions-done"
			onclick={() => onDoneScoring(game)}
		>
			Fertig
		</button>
	{:else}
		<button
			type="button"
			class="button GamePlayActions-pass"
			class:button-primary={isOurMove}
			disabled={!isOurMove}
			onclick={pass}
		>
			Passen
		</button>
	{/if}
	<button
		type="button"
		class="button GamePlayActions-undo"
		title="Den Gegner bitten, den letzten Zug zurückzunehmen"
		onclick={() => onUndo(game)}
	>
		Zug zurück
	</button>
	{#if confirmingResign}
		<span class="GamePlayActions-confirm" role="group" aria-label="Wirklich aufgeben?">
			<span>Wirklich aufgeben?</span>
			<button
				type="button"
				class="button GamePlayActions-resign"
				onclick={() => {
					confirmingResign = false;
					onResign(game);
				}}
			>
				Ja, aufgeben
			</button>
			<button type="button" class="button" onclick={() => (confirmingResign = false)}>
				Weiter spielen
			</button>
		</span>
	{:else}
		<button
			type="button"
			class="button GamePlayActions-resign"
			onclick={() => (confirmingResign = true)}
		>
			Aufgeben
		</button>
	{/if}
	<div class="GamePlayActions-more-container" bind:this={moreEl}>
		<button
			type="button"
			class="button GamePlayActions-more"
			aria-expanded={moreShowing}
			aria-controls="{uid}-more"
			onclick={() => (moreShowing = !moreShowing)}
		>
			Mehr <span aria-hidden="true">▾</span>
		</button>
		{#if moreShowing}
			<div class="GamePlayActions-more-menu panel" id="{uid}-more">
				<button type="button" class="GamePlayActions-more-item" onclick={() => addTime(ONE_MINUTE)}>
					1 Minute schenken
				</button>
				<button
					type="button"
					class="GamePlayActions-more-item"
					onclick={() => addTime(FIVE_MINUTES)}
				>
					5 Minuten schenken
				</button>
				<hr class="GamePlayActions-more-menu-separator" />
				<button
					type="button"
					class="GamePlayActions-more-item GamePlayActions-leave"
					onclick={leave}
				>
					Partie verlassen
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.GamePlayActions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}

	.GamePlayActions > .button,
	.GamePlayActions-more {
		justify-content: center;
		width: 100%;
		min-height: 40px;
	}

	.GamePlayActions-pass:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.GamePlayActions-resign {
		color: var(--danger, #b3261e);
	}

	.GamePlayActions-more-container {
		position: relative;
	}

	.GamePlayActions-more-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 20;
		display: flex;
		flex-direction: column;
		min-width: 12rem;
		padding: 6px;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
	}

	.GamePlayActions-more-item {
		min-height: 40px;
		padding: 8px 12px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.GamePlayActions-more-item:hover {
		background: var(--accent-soft);
	}

	.GamePlayActions-leave {
		color: var(--danger, #b3261e);
	}

	.GamePlayActions-more-menu-separator {
		width: 100%;
		margin: 4px 0;
		border: 0;
		border-top: 1px solid var(--rule);
	}

	:global([data-design='oldschool']) .GamePlayActions {
		gap: 4px;
	}

	:global([data-design='oldschool']) .GamePlayActions > .button,
	:global([data-design='oldschool']) .GamePlayActions-more {
		min-height: 30px;
	}

	:global([data-design='oldschool']) .GamePlayActions-more-menu {
		padding: 2px;
		box-shadow: 2px 2px 0 #000;
	}

	:global([data-design='oldschool']) .GamePlayActions-more-item {
		min-height: 0;
		padding: 3px 8px;
	}

	:global([data-design='oldschool']) .GamePlayActions-more-item:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}

	@media (max-width: 400px) {
		.GamePlayActions > .button,
		.GamePlayActions-more {
			padding-left: 6px;
			padding-right: 6px;
		}
	}

	.GamePlayActions-confirm {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}
</style>
