<script lang="ts">
	// The round badge of a game's type: R(anked), F(ree), D(emo), T(eaching),
	// S(imul), 2 (rengo), C(hallenge), a trophy for tournaments, a lock for
	// private games and a top hat for KGS Plus subscriber games.
	import type { GameType } from '#lib/model/types.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	let {
		type,
		subscribersOnly = false,
		isPrivate = false
	}: {
		type: GameType;
		subscribersOnly?: boolean;
		isPrivate?: boolean;
	} = $props();

	const GAME_TYPE_CODE: Record<GameType, string> = {
		challenge: 'C',
		demonstration: 'D',
		review: 'D',
		rengo_review: 'D',
		teaching: 'T',
		simul: 'S',
		rengo: '2',
		free: 'F',
		ranked: 'R',
		tournament: '🏆'
	};

	const GAME_TYPE_LABEL: Record<GameType, MessageKey> = {
		challenge: 'game.type.challenge',
		demonstration: 'game.type.demonstration',
		review: 'game.type.review',
		rengo_review: 'game.type.rengoReview',
		teaching: 'game.type.teaching',
		simul: 'game.type.simul',
		rengo: 'game.type.rengo',
		free: 'game.typeIcon.free',
		ranked: 'game.typeIcon.ranked',
		tournament: 'game.typeIcon.tournament'
	};

	let code = $derived(subscribersOnly ? '🎩' : isPrivate ? '🔒' : (GAME_TYPE_CODE[type] ?? '?'));
	let label = $derived(
		subscribersOnly
			? t('game.typeIcon.subscribers')
			: isPrivate
				? t('game.typeIcon.private')
				: GAME_TYPE_LABEL[type]
					? t(GAME_TYPE_LABEL[type])
					: type
	);
</script>

<span
	class="GameTypeIcon GameTypeIcon-{isPrivate ? 'private' : type}"
	role="img"
	aria-label={label}
	title={label}
>
	<span class="GameTypeIcon-code" aria-hidden="true">{code}</span>
</span>

<style>
	.GameTypeIcon {
		--type-color: var(--ink-soft);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--type-color);
		color: #ffffff;
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
	}

	/* The type colours of the old app, a little deeper so white text reads. */
	.GameTypeIcon-ranked {
		--type-color: var(--accent);
	}

	.GameTypeIcon-free {
		--type-color: #2f8fa6;
	}

	.GameTypeIcon-rengo {
		--type-color: #9a9a2c;
	}

	.GameTypeIcon-simul {
		--type-color: #7a62c9;
	}

	.GameTypeIcon-demonstration,
	.GameTypeIcon-review,
	.GameTypeIcon-rengo_review,
	.GameTypeIcon-teaching {
		--type-color: #b03c86;
	}

	.GameTypeIcon-tournament {
		--type-color: #d9800f;
	}

	.GameTypeIcon-code {
		font-size: 12px;
	}

	:global([data-design='oldschool']) .GameTypeIcon {
		width: 18px;
		height: 18px;
		border: 1px solid #000000;
		font-size: 11px;
	}
</style>
