<script lang="ts">
	// Filter above a game or challenge list: one room (rooms with the most
	// games first) and whether games with bots are shown. Changes go to
	// `onChange` as a new filter; the app remembers it (watchFilter/playFilter).
	import type { GameChannel, GameFilter, Index, Room } from '#lib/model/types.ts';

	let {
		games,
		roomsById,
		filter,
		onChange
	}: {
		games: Array<GameChannel>;
		roomsById: Index<Room>;
		filter: GameFilter;
		onChange: (filter: GameFilter) => unknown;
	} = $props();

	const uid = $props.id();

	let isChallenges = $derived(!!games[0] && games[0].type === 'challenge');
	let type: 'challenge' | 'game' = $derived(isChallenges ? 'challenge' : 'game');

	// Rooms that have games in the list, with a name, most games first.
	let rooms = $derived.by(() => {
		const byId: Record<number, { id: number; name: string | null | undefined; count: number }> = {};
		for (const game of games) {
			if (!game.roomId) continue;
			const entry = byId[game.roomId];
			if (entry) entry.count++;
			else byId[game.roomId] = { id: game.roomId, name: roomsById[game.roomId]?.name, count: 1 };
		}
		return Object.values(byId)
			.filter((room) => room.name)
			.sort((a, b) => b.count - a.count);
	});

	function onChangeRoom(event: Event) {
		const roomId = parseInt((event.currentTarget as HTMLSelectElement).value, 10);
		onChange({ ...filter, type, roomId: roomId || null });
	}

	function onChangeBots(event: Event) {
		onChange({ ...filter, type, excludeBots: !(event.currentTarget as HTMLInputElement).checked });
	}

	function onClearRoom() {
		onChange({ ...filter, roomId: null });
	}
</script>

<div class="GameListFilter">
	<div class="GameListFilter-room" class:GameListFilter-room-active={!!filter.roomId}>
		<label class="visually-hidden" for="{uid}-room">Raum</label>
		<select
			id="{uid}-room"
			value={filter.roomId ? String(filter.roomId) : ''}
			onchange={onChangeRoom}
		>
			<option value="">{isChallenges ? 'Alle Herausforderungen' : 'Alle Partien'}</option>
			{#each rooms as room (room.id)}
				<option value={String(room.id)}>{room.name}</option>
			{/each}
		</select>
		{#if filter.roomId}
			<button
				type="button"
				class="GameListFilter-room-clear"
				aria-label="Raumfilter aufheben"
				title="Raumfilter aufheben"
				onclick={onClearRoom}
			>
				×
			</button>
		{/if}
	</div>
	<label class="GameListFilter-bots">
		<input type="checkbox" checked={!filter.excludeBots} onchange={onChangeBots} />
		Bots
	</label>
</div>

<style>
	.GameListFilter {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 16px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--rule);
	}

	.GameListFilter-room {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		flex: 0 1 22rem;
	}

	select {
		flex: 1;
		min-width: 0;
		min-height: 36px;
		padding: 4px 10px;
		border: var(--button-border);
		border-radius: var(--radius-pill);
		background: var(--button-bg);
		color: var(--ink);
		font: inherit;
	}

	.GameListFilter-room-active select {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.GameListFilter-room-clear {
		min-width: 36px;
		min-height: 36px;
		border: 0;
		border-radius: var(--radius-pill);
		background: none;
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		color: var(--ink-soft);
	}

	.GameListFilter-room-clear:hover {
		color: var(--ink);
	}

	.GameListFilter-bots {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		cursor: pointer;
	}

	.GameListFilter-bots input {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	:global([data-design='oldschool']) .GameListFilter {
		padding: 4px 6px;
		border-bottom: 1px solid #808080;
	}

	:global([data-design='oldschool']) select {
		min-height: 0;
		padding: 1px 4px;
		border: 2px inset #ece9e2;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .GameListFilter-room-clear,
	:global([data-design='oldschool']) .GameListFilter-bots {
		min-height: 0;
	}
</style>
