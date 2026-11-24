<script lang="ts">
	// The players of a game, one per line: white (or the owner of a demo, or
	// the creator of a challenge), white's rengo partner, black, black's rengo
	// partner. A dot marks the winner's side.
	import type { GamePlayers, PlayerColor } from '#lib/model/types.ts';
	import UserName from '#lib/ui/UserName.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		players,
		winner = null
	}: {
		players: GamePlayers | null | undefined;
		winner?: PlayerColor | null;
	} = $props();

	let player1 = $derived(players?.white || players?.owner || players?.challengeCreator);
	let player2 = $derived(players?.black);
	let white2 = $derived(players?.white_2);
	let black2 = $derived(players?.black_2);
</script>

{#if players}
	<div class="GamePlayersList">
		{#if player1}
			{@const won = winner === 'white' && !!players.white}
			<div
				class="GamePlayersList-player GamePlayersList-player1"
				class:GamePlayersList-winner={won}
			>
				{#if won}<span class="sr-only">{t('game.players.winnerPrefix')}</span>{/if}<UserName
					user={player1}
				/>
			</div>
		{/if}
		{#if white2}
			<div
				class="GamePlayersList-player GamePlayersList-white2"
				class:GamePlayersList-winner={winner === 'white'}
			>
				{#if winner === 'white'}<span class="sr-only">
						{t('game.players.winnerPrefix')}
					</span>{/if}<UserName user={white2} />
			</div>
		{/if}
		{#if player2}
			<div
				class="GamePlayersList-player GamePlayersList-player2"
				class:GamePlayersList-winner={winner === 'black'}
			>
				{#if winner === 'black'}<span class="sr-only">
						{t('game.players.winnerPrefix')}
					</span>{/if}<UserName user={player2} />
			</div>
		{/if}
		{#if black2}
			<div
				class="GamePlayersList-player GamePlayersList-black2"
				class:GamePlayersList-winner={winner === 'black'}
			>
				{#if winner === 'black'}<span class="sr-only">
						{t('game.players.winnerPrefix')}
					</span>{/if}<UserName user={black2} />
			</div>
		{/if}
	</div>
{/if}

<style>
	.GamePlayersList-player {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.GamePlayersList-winner {
		position: relative;
	}

	.GamePlayersList-winner::before {
		content: '';
		position: absolute;
		left: -10px;
		top: 50%;
		width: 6px;
		height: 6px;
		margin-top: -3px;
		border-radius: 50%;
		background: var(--accent);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
