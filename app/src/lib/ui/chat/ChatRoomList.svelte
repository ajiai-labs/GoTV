<script lang="ts">
	// All KGS rooms by category, with a search field. A click joins the room;
	// the star beside it marks a favourite, joined after every login
	// (FavoriteRoomsWatcher).
	import type { Index, Room, RoomCategory } from '#lib/model/types.ts';
	import { isMobileScreen } from '#lib/util/dom.ts';
	import { quoteRegExpPattern } from '#lib/util/string.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { favoriteRooms } from './favoriteRooms.svelte.ts';

	const CAT_LABELS: Record<RoomCategory, MessageKey> = {
		MAIN: 'chat.rooms.main',
		NATIONAL: 'chat.rooms.national',
		TOURNAMENT: 'chat.rooms.tournament',
		FRIENDLY: 'chat.rooms.friendly',
		SPECIAL: 'chat.rooms.special',
		LESSONS: 'chat.rooms.lessons',
		CLUBS: 'chat.rooms.clubs',
		TEMPORARY: 'chat.rooms.temporary',
		OTHER: 'chat.rooms.other'
	};

	let {
		roomsById,
		onJoinRoom
	}: {
		roomsById: Index<Room>;
		onJoinRoom: (room: Room) => unknown;
	} = $props();

	let search = $state('');
	let input: HTMLInputElement | undefined = $state();

	let categories = $derived.by(() => {
		// Without the "g" flag: the old list used "gi" with test(), which
		// skipped every second match.
		const searchRegex = search ? new RegExp(quoteRegExpPattern(search), 'i') : null;
		const roomsByCat: Partial<Record<string, Array<Room & { name: string }>>> = {};
		for (const room of Object.values(roomsById)) {
			const name = room.name;
			if (!name || (searchRegex && !searchRegex.test(name))) continue;
			const cat = room.category || 'OTHER';
			(roomsByCat[cat] ??= []).push({ ...room, name });
		}
		return Object.entries(roomsByCat).map(([cat, rooms = []]) => ({
			cat,
			label: t(CAT_LABELS[cat as RoomCategory] ?? CAT_LABELS.OTHER),
			rooms: [...rooms].sort((a, b) => a.name.localeCompare(b.name))
		}));
	});

	$effect(() => {
		// As before: the search takes the focus, except on phones (keyboard).
		if (!input || isMobileScreen()) return;
		const target = input;
		const frame = requestAnimationFrame(() => target.focus());
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="ChatRoomList">
	<input
		bind:this={input}
		bind:value={search}
		class="ChatRoomList-search"
		type="search"
		placeholder={t('chat.rooms.search')}
		aria-label={t('chat.rooms.search')}
		autocomplete="off"
	/>
	<p class="ChatRoomList-hint muted">{t('chat.rooms.favoritesHint')}</p>
	{#each categories as category (category.cat)}
		<section class="ChatRoomList-cat">
			<h3 class="ChatRoomList-cat-title">{category.label}</h3>
			<ul class="ChatRoomList-rooms">
				{#each category.rooms as room (room.id)}
					{@const favorite = favoriteRooms.has(room.id)}
					{@const starLabel = favorite
						? t('chat.rooms.favoriteRemove', { name: room.name })
						: t('chat.rooms.favoriteAdd', { name: room.name })}
					<li class="ChatRoomList-item">
						<button type="button" class="ChatRoomList-room" onclick={() => onJoinRoom(room)}>
							{room.name}{#if room.private}<span title={t('chat.rooms.private')}> 🔒</span>{/if}
						</button>
						<button
							type="button"
							class="ChatRoomList-star"
							class:ChatRoomList-star-active={favorite}
							aria-pressed={favorite}
							aria-label={starLabel}
							title={starLabel}
							onclick={() => favoriteRooms.toggle(room)}
						>
							{favorite ? '★' : '☆'}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.ChatRoomList {
		padding-top: 8px;
	}

	.ChatRoomList-search {
		width: 100%;
		min-height: 40px;
		padding: 8px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: max(16px, 1em);
	}

	.ChatRoomList-search:focus {
		border-color: var(--accent);
		outline: 2px solid var(--accent-soft);
		outline-offset: 0;
	}

	.ChatRoomList-hint {
		margin: 6px 4px 0;
		font-size: 0.85em;
	}

	.ChatRoomList-cat {
		padding-top: 16px;
	}

	.ChatRoomList-cat-title {
		margin: 0;
		padding: 4px 0;
		border-bottom: 2px solid var(--rule);
		font-size: 1em;
		font-weight: 650;
	}

	.ChatRoomList-rooms {
		margin: 0;
		padding: 6px 0 0;
		list-style: none;
		columns: 2;
		column-gap: 12px;
	}

	.ChatRoomList-item {
		display: flex;
		align-items: center;
		break-inside: avoid;
	}

	.ChatRoomList-room {
		display: block;
		flex: 1;
		min-width: 0;
		min-height: 32px;
		padding: 4px 8px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		color: var(--accent);
		text-align: left;
		cursor: pointer;
	}

	.ChatRoomList-room:hover {
		background: var(--accent-soft);
	}

	.ChatRoomList-star {
		flex: none;
		min-width: 36px;
		min-height: 32px;
		padding: 0 6px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		color: var(--ink-soft);
		font-size: 1.15rem;
		line-height: 1;
		cursor: pointer;
	}

	.ChatRoomList-star:hover,
	.ChatRoomList-star-active {
		color: #c8962b;
	}

	@media (max-width: 480px) {
		.ChatRoomList-rooms {
			columns: 1;
		}
	}

	:global([data-design='oldschool']) .ChatRoomList-search {
		min-height: 28px;
		padding: 3px 6px;
		border: 2px inset #ece9e2;
		border-radius: 0;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .ChatRoomList-cat-title {
		border-bottom-color: #808080;
	}

	:global([data-design='oldschool']) .ChatRoomList-room {
		min-height: 24px;
		padding: 2px 6px;
		color: var(--ink);
	}

	:global([data-design='oldschool']) .ChatRoomList-star {
		min-height: 24px;
		border-radius: 0;
	}

	:global([data-design='oldschool']) .ChatRoomList-room:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
