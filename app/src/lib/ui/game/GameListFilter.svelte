<script lang="ts">
	// Filter above a game or challenge list: one room (rooms with the most
	// games first) and whether games with bots are shown; for running games
	// also (28.11.2026) a search for players/rooms, board size, pace, only
	// tournament games and the order. Changes go to `onChange` as a new
	// filter; the app remembers it (watchFilter/playFilter).
	import type {
		GameChannel,
		GameFilter,
		GameSort,
		GameSpeedFilter,
		Index,
		Room
	} from '#lib/model/types.ts';
	import { filterGames, hasKnownSpeed } from '#lib/model/game/filter.ts';

	import { t } from '#lib/i18n/index.svelte.ts';

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

	function update(change: Partial<GameFilter>) {
		onChange({ ...filter, type, ...change });
	}

	const SIZES = [19, 13, 9] as const;
	const SPEEDS: Array<GameSpeedFilter> = ['veryFast', 'fast', 'normal', 'slow'];
	const SORTS: Array<GameSort> = ['default', 'strength', 'observers', 'new'];

	let showSpeed = $derived(hasKnownSpeed(games) || !!filter.speed);
	let narrowed = $derived(
		!!(filter.query?.trim() || filter.size || filter.speed || filter.tournamentOnly)
	);
	let shownCount = $derived(filterGames(games, filter, roomsById).length);

	function onReset() {
		update({ query: '', size: null, speed: null, tournamentOnly: false });
	}
</script>

<div class="GameListFilter">
	<div class="GameListFilter-room" class:GameListFilter-room-active={!!filter.roomId}>
		<label class="visually-hidden" for="{uid}-room">{t('play.filter.room')}</label>
		<select
			id="{uid}-room"
			value={filter.roomId ? String(filter.roomId) : ''}
			onchange={onChangeRoom}
		>
			<option value="">
				{isChallenges ? t('play.filter.allChallenges') : t('play.filter.allGames')}
			</option>
			{#each rooms as room (room.id)}
				<option value={String(room.id)}>{room.name}</option>
			{/each}
		</select>
		{#if filter.roomId}
			<button
				type="button"
				class="GameListFilter-room-clear"
				aria-label={t('play.filter.clearRoom')}
				title={t('play.filter.clearRoom')}
				onclick={onClearRoom}
			>
				×
			</button>
		{/if}
	</div>
	<label class="GameListFilter-bots">
		<input type="checkbox" checked={!filter.excludeBots} onchange={onChangeBots} />
		{t('play.filter.bots')}
	</label>
	{#if !isChallenges}
		<input
			type="search"
			class="GameListFilter-query"
			value={filter.query ?? ''}
			placeholder={t('play.filter.queryPlaceholder')}
			aria-label={t('play.filter.query')}
			oninput={(event) => update({ query: event.currentTarget.value })}
		/>
		<select
			aria-label={t('play.filter.size')}
			value={filter.size ? String(filter.size) : ''}
			onchange={(event) => {
				const size = Number(event.currentTarget.value);
				update({ size: size === 9 || size === 13 || size === 19 ? size : null });
			}}
		>
			<option value="">{t('play.filter.allSizes')}</option>
			{#each SIZES as size (size)}
				<option value={String(size)}>{size}×{size}</option>
			{/each}
		</select>
		{#if showSpeed}
			<select
				aria-label={t('play.filter.speed')}
				value={filter.speed ?? ''}
				onchange={(event) =>
					update({ speed: (event.currentTarget.value || null) as GameSpeedFilter | null })}
			>
				<option value="">{t('play.filter.allSpeeds')}</option>
				{#each SPEEDS as speed (speed)}
					<option value={speed}>{t(`play.filter.speed.${speed}`)}</option>
				{/each}
			</select>
		{/if}
		<label class="GameListFilter-bots">
			<input
				type="checkbox"
				checked={!!filter.tournamentOnly}
				onchange={(event) => update({ tournamentOnly: event.currentTarget.checked })}
			/>
			{t('play.filter.tournamentOnly')}
		</label>
		<select
			aria-label={t('play.filter.sort')}
			value={filter.sort ?? 'default'}
			onchange={(event) => update({ sort: event.currentTarget.value as GameSort })}
		>
			{#each SORTS as sort (sort)}
				<option value={sort}>{t(`play.filter.sort.${sort}`)}</option>
			{/each}
		</select>
		{#if narrowed}
			<span class="GameListFilter-count" role="status">
				{t('play.filter.count', { shown: shownCount, total: games.length })}
			</span>
			<button type="button" class="GameListFilter-reset" onclick={onReset}>
				{t('play.filter.reset')}
			</button>
		{/if}
	{/if}
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
		flex: 0 1 16rem;
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

	.GameListFilter-query {
		flex: 0 1 14rem;
		min-width: 9rem;
		min-height: 36px;
		padding: 4px 12px;
		border: var(--button-border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}

	.GameListFilter > select {
		flex: 0 0 auto;
	}

	.GameListFilter-count {
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.GameListFilter-reset {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
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
		border-bottom: 1px solid var(--bevel-dark, #808080);
	}

	:global([data-design='oldschool']) select {
		min-height: 0;
		padding: 1px 4px;
		border: 2px inset var(--bevel-face, #ece9e2);
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .GameListFilter-room-clear,
	:global([data-design='oldschool']) .GameListFilter-bots {
		min-height: 0;
	}
</style>
