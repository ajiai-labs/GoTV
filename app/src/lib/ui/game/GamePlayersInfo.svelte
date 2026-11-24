<script lang="ts">
	// The players of a game, white above black: avatar, stone, name (rengo:
	// both partners), captures, clock and the winner. A demonstration without
	// players shows its owner instead of white. A click on a name opens the
	// user's details.
	import { app } from '#lib/app.svelte.ts';
	import { getWinningColor } from '#lib/model/game/display.ts';
	import type { ClockState, GameChannel, User } from '#lib/model/types.ts';
	import UserName from '#lib/ui/UserName.svelte';
	import UserAvatar from '#lib/ui/user/UserAvatar.svelte';
	import GameClock from './GameClock.svelte';

	type Side = {
		color: 'white' | 'black' | 'owner';
		player1: User | undefined;
		player2: User | undefined;
		captures: number;
		timeLeft: number;
		clock: ClockState | undefined;
		winner: boolean;
	};

	let {
		game,
		onUserDetail = (user: User) => app.actions.onUserDetail(user.name)
	}: {
		game: GameChannel;
		onUserDetail?: (user: User) => unknown;
	} = $props();

	let players = $derived(game.players);
	let winner = $derived(getWinningColor(game.score));
	let nodeId = $derived(game.tree?.currentNode);
	let computed = $derived(
		game.tree && typeof nodeId === 'number' ? game.tree.computedState[nodeId] : undefined
	);
	let gameActive = $derived(!!game.tree && !game.over && nodeId === game.tree.activeNode);
	let isRengo = $derived(!!players?.white_2 && !!players?.black_2);

	let sides: Array<Side> = $derived.by(() => {
		if (!players) return [];
		const noPlayers = !players.white && !players.white_2 && !players.black && !players.black_2;
		const color1 = noPlayers ? 'owner' : 'white';
		return [
			{
				color: color1,
				player1: noPlayers ? players.owner : players.white,
				player2: noPlayers ? undefined : players.white_2,
				captures: computed ? computed.whiteCaptures : 0,
				timeLeft: computed ? computed.whiteTimeLeft : -1,
				clock: game.clocks?.[color1],
				winner: winner === 'white'
			},
			{
				color: 'black',
				player1: players.black,
				player2: players.black_2,
				captures: computed ? computed.blackCaptures : 0,
				timeLeft: computed ? computed.blackTimeLeft : -1,
				clock: game.clocks?.black,
				winner: winner === 'black'
			}
		];
	});

	const COLOR_LABEL = { white: 'Weiß', black: 'Schwarz', owner: 'Besitzer der Partie' };
</script>

{#if players}
	<div class="GamePlayersInfo" class:GamePlayersInfo-rengo={isRengo}>
		{#each sides as side (side.color)}
			{#if side.player1 || side.player2}
				<div
					class="GamePlayersInfo-color GamePlayersInfo-{side.color}"
					class:GamePlayersInfo-winner={side.winner}
				>
					<button
						type="button"
						class="GamePlayersInfo-avatar"
						tabindex="-1"
						aria-hidden="true"
						onclick={() => side.player1 && onUserDetail(side.player1)}
					>
						<UserAvatar user={side.player1} />
					</button>
					<div class="GamePlayersInfo-players">
						{#if side.player1}
							<div class="GamePlayersInfo-player1">
								{#if side.color === 'owner'}
									<span class="GamePlayersInfo-icon" aria-hidden="true">✏️</span>
								{:else}
									<span
										class="GamePlayersInfo-stone {side.color}"
										role="img"
										aria-label={COLOR_LABEL[side.color]}
									></span>
								{/if}
								<button
									type="button"
									class="GamePlayersInfo-name"
									onclick={() => side.player1 && onUserDetail(side.player1)}
								>
									<UserName user={side.player1} />
								</button>
							</div>
						{/if}
						{#if side.player2}
							<div class="GamePlayersInfo-player2">
								<button
									type="button"
									class="GamePlayersInfo-name"
									onclick={() => side.player2 && onUserDetail(side.player2)}
								>
									<UserName user={side.player2} />
								</button>
							</div>
						{/if}
						{#if side.color === 'owner'}
							<div class="GamePlayersInfo-role muted">{COLOR_LABEL.owner}</div>
						{:else}
							<div class="GamePlayersInfo-captures muted">
								{side.captures} Gefangene
								{#if side.winner}
									<span class="GamePlayersInfo-winner-badge">✓ Sieger</span>
								{/if}
							</div>
						{/if}
					</div>
					{#if side.color !== 'owner' && side.clock}
						<div class="GamePlayersInfo-clock">
							<GameClock
								{nodeId}
								active={gameActive}
								clock={side.clock}
								timeLeft={side.timeLeft}
								gameRules={game.rules}
							/>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.GamePlayersInfo {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.GamePlayersInfo-color {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: var(--radius-s);
	}

	.GamePlayersInfo-winner {
		background: var(--accent-soft);
	}

	.GamePlayersInfo-avatar {
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.GamePlayersInfo-players {
		min-width: 0;
	}

	.GamePlayersInfo-player1,
	.GamePlayersInfo-player2 {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.GamePlayersInfo-player2 {
		padding-left: 22px;
		font-size: 0.92em;
	}

	.GamePlayersInfo-stone {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex: none;
	}

	.GamePlayersInfo-stone.black {
		background: radial-gradient(circle at 35% 30%, #4a524e, #0c0e0d 70%);
	}

	.GamePlayersInfo-stone.white {
		background: radial-gradient(circle at 35% 30%, #ffffff, #d5dbd4 80%);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}

	.GamePlayersInfo-icon {
		flex: none;
		font-size: 0.9em;
	}

	.GamePlayersInfo-name {
		min-width: 0;
		padding: 2px 0;
		border: 0;
		background: none;
		color: var(--ink);
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.GamePlayersInfo-name:hover {
		text-decoration: underline;
	}

	.GamePlayersInfo-captures,
	.GamePlayersInfo-role {
		display: flex;
		flex-wrap: wrap;
		gap: 0 8px;
		padding-left: 22px;
		font-size: 0.85em;
	}

	.GamePlayersInfo-owner .GamePlayersInfo-role {
		padding-left: 0;
	}

	.GamePlayersInfo-winner-badge {
		font-size: 0.85em;
		font-weight: 650;
		color: var(--accent);
		white-space: nowrap;
	}

	:global([data-design='oldschool']) .GamePlayersInfo {
		gap: 2px;
	}

	:global([data-design='oldschool']) .GamePlayersInfo-color {
		padding: 3px 4px;
		background: var(--surface-sunk);
		border: 1px solid #808080;
	}

	:global([data-design='oldschool']) .GamePlayersInfo-winner {
		background: var(--warn-bg, #fff7c2);
	}

	:global([data-design='oldschool']) .GamePlayersInfo-stone {
		border-radius: 50%;
	}
</style>
