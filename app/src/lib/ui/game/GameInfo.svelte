<script lang="ts">
	// The facts of a game as a table: name, type, handicap, komi, time,
	// rules, room. Further rows (GameMoreMenu: size, ID, date, result, SGF
	// details) come as children.
	import type { Snippet } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import type { GameChannel, Index, Room } from '#lib/model/types.ts';
	import GameTimeSystem from './GameTimeSystem.svelte';
	import { formatGameTypeDe, formatRulesetDe } from './gameText.ts';

	let {
		game,
		roomsById,
		children
	}: {
		game: GameChannel;
		// Default: the rooms the app knows.
		roomsById?: Index<Room>;
		children?: Snippet;
	} = $props();

	let rules = $derived(game.rules);
	let room = $derived((roomsById ?? app.state.roomsById)[game.roomId]);
</script>

<div class="GameInfo">
	<table class="GameInfo-table">
		<tbody>
			{#if game.name}
				<tr><th scope="row">Name</th><td>{game.name}</td></tr>
			{/if}
			<tr><th scope="row">Art</th><td>{formatGameTypeDe(game.type)}</td></tr>
			{#if rules}
				{#if rules.handicap}
					<tr><th scope="row">Vorgabe</th><td>{rules.handicap}</td></tr>
				{/if}
				<tr><th scope="row">Komi</th><td>{rules.komi}</td></tr>
				{#if rules.timeSystem}
					<tr><th scope="row">Zeit</th><td><GameTimeSystem {rules} /></td></tr>
				{/if}
				{#if rules.rules}
					<tr><th scope="row">Regeln</th><td>{formatRulesetDe(rules.rules)}</td></tr>
				{/if}
			{/if}
			{#if room && room.name}
				<tr><th scope="row">Raum</th><td>{room.name}</td></tr>
			{/if}
			{@render children?.()}
		</tbody>
	</table>
</div>

<style>
	.GameInfo-table {
		width: 100%;
		border-collapse: collapse;
	}

	.GameInfo-table :global(th),
	.GameInfo-table :global(td) {
		padding: 5px 8px;
		border-bottom: 1px solid var(--rule);
		text-align: left;
		vertical-align: top;
	}

	.GameInfo-table :global(th) {
		width: 7.5rem;
		font-weight: 500;
		color: var(--ink-soft);
	}

	.GameInfo-table :global(tr:last-child th),
	.GameInfo-table :global(tr:last-child td) {
		border-bottom: 0;
	}

	:global([data-design='oldschool']) .GameInfo-table :global(th),
	:global([data-design='oldschool']) .GameInfo-table :global(td) {
		padding: 2px 6px;
		border-bottom: 1px solid #d4d0c8;
	}
</style>
