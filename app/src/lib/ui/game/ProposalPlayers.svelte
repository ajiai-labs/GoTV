<script lang="ts" module>
	import type { GameRole } from '#lib/model/types.ts';

	const ROLE_DE: Record<GameRole, string> = {
		black: 'Schwarz',
		white: 'Weiß',
		black_2: 'Schwarz 2',
		white_2: 'Weiß 2',
		challengeCreator: 'Ersteller',
		owner: 'Besitzer'
	};

	// formatGameRole (taken over unchanged) in German.
	export function formatGameRoleDe(role: GameRole): string {
		return ROLE_DE[role] ?? role;
	}
</script>

<script lang="ts">
	// The players of a challenge proposal, side by side: above each the colour
	// (a click changes it, see ProposalForm), below the name (a click opens
	// the user's details). With nigiri both get a half black, half white
	// stone and are numbered. Yellow marks what differs from the previous
	// proposal: the colours, and the opponent.
	import type { GameProposalPlayer, Index, User } from '#lib/model/types.ts';
	import UserName from '#lib/ui/UserName.svelte';
	import NigiriIcon from '#lib/ui/board/NigiriIcon.svelte';

	let {
		currentUser,
		players,
		prevPlayers = null,
		nigiri,
		prevNigiri = null,
		usersByName,
		onUserDetail,
		onToggleRole
	}: {
		currentUser: User;
		players: Array<GameProposalPlayer>;
		prevPlayers?: Array<GameProposalPlayer> | null;
		nigiri: boolean;
		prevNigiri?: boolean | null;
		usersByName: Index<User>;
		onUserDetail: (name: string) => unknown;
		onToggleRole: (name: string) => unknown;
	} = $props();

	function nameOf(player: GameProposalPlayer): string | undefined {
		return player.user ? player.user.name : player.name;
	}

	function userOf(name: string | undefined): User | string | undefined {
		return name ? (usersByName[name] ?? name) : undefined;
	}

	function roleChanged(player: GameProposalPlayer, prevPlayer: GameProposalPlayer | undefined) {
		return (
			(prevNigiri !== null && prevNigiri !== nigiri) ||
			(!nigiri && !!prevPlayer && prevPlayer.role !== player.role)
		);
	}
</script>

<div class="ProposalPlayers">
	{#each players as player, i (i + '-' + (nameOf(player) ?? ''))}
		{@const name = nameOf(player)}
		{@const user = userOf(name)}
		{@const roleHilite = roleChanged(player, prevPlayers ? prevPlayers[i] : undefined)}
		{@const playerHilite = i > 0 && !!name && currentUser.name !== name}
		{@const roleName = nigiri ? `Spieler ${i + 1}` : formatGameRoleDe(player.role)}
		<div
			class="ProposalPlayers-item"
			class:ProposalPlayers-item-player-hilite={playerHilite}
			class:ProposalPlayers-item-role-hilite={roleHilite}
		>
			<button
				type="button"
				class="ProposalPlayers-role"
				aria-label="{roleName}{nigiri ? ' (Nigiri)' : ''} – Farbe wechseln"
				onclick={() => user && onToggleRole(typeof user === 'string' ? user : user.name)}
			>
				<span class="ProposalPlayers-role-icon" aria-hidden="true">
					{#if nigiri}
						<NigiriIcon />
					{:else if player.role === 'white' || player.role === 'black'}
						<svg viewBox="0 0 24 24">
							<circle cx="12" cy="12" r="11" class="stone stone-{player.role}" />
						</svg>
					{/if}
				</span>
				<span class="ProposalPlayers-role-name">{roleName}</span>
			</button>
			<button
				type="button"
				class="ProposalPlayers-player-button"
				disabled={!user}
				onclick={() => user && onUserDetail(typeof user === 'string' ? user : user.name)}
			>
				{#if user}
					{#if typeof user === 'string'}
						{user}
					{:else}
						<UserName {user} extraIcons />
					{/if}
				{:else}
					<span class="muted">– offen –</span>
				{/if}
			</button>
		</div>
	{/each}
</div>

<style>
	.ProposalPlayers {
		display: flex;
		gap: 8px;
	}

	.ProposalPlayers-item {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		max-width: 50%;
		border: 1px solid var(--rule);
		border-radius: var(--radius-m);
		overflow: hidden;
	}

	.ProposalPlayers-role {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 44px;
		padding: 8px 12px;
		border: 0;
		background: var(--stage);
		color: var(--stage-ink);
		text-align: left;
		cursor: pointer;
	}

	.ProposalPlayers-role:hover {
		filter: brightness(1.15);
	}

	.ProposalPlayers-role-icon {
		flex: none;
		width: 24px;
		height: 24px;
	}

	.ProposalPlayers-role-icon svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.stone {
		stroke: #1b1b1b;
		stroke-width: 1;
	}

	.stone-black {
		fill: #1b1b1b;
		stroke: #6b6b6b;
	}

	.stone-white {
		fill: #f4f1ea;
	}

	.ProposalPlayers-role-name {
		padding: 0 4px;
		border-radius: var(--radius-s);
		font-weight: 650;
	}

	.ProposalPlayers-item-role-hilite .ProposalPlayers-role-name {
		background: #fff1a9;
		color: #1d2421;
	}

	.ProposalPlayers-player-button {
		flex: 1;
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 0;
		background: var(--surface-sunk);
		color: var(--ink);
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}

	.ProposalPlayers-player-button:hover:not(:disabled) {
		filter: brightness(0.96);
	}

	.ProposalPlayers-player-button:disabled {
		cursor: default;
	}

	.ProposalPlayers-item-player-hilite .ProposalPlayers-player-button {
		background: #fff1a9;
		color: #1d2421;
	}

	:global([data-design='oldschool']) .ProposalPlayers-item {
		border: 2px solid;
		border-color: #808080 #ffffff #ffffff #808080;
		border-radius: 0;
	}

	:global([data-design='oldschool']) .ProposalPlayers-role {
		min-height: 32px;
		padding: 3px 6px;
		background: var(--title-bar);
		color: var(--title-ink);
	}

	:global([data-design='oldschool']) .ProposalPlayers-player-button {
		min-height: 32px;
		padding: 4px 6px;
	}
</style>
