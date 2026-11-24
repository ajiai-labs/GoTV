<script lang="ts">
	// Live (draft): the stage - stream next to the board - and what comes next.
	import Board from '#lib/ui/Board.svelte';
	import PlayerBar from '#lib/ui/PlayerBar.svelte';
	import WinCurve from '#lib/ui/WinCurve.svelte';
	import BoardNav from '#lib/ui/BoardNav.svelte';
	import { finalPosition, sampleCurve, upcoming } from '#lib/demo/index.ts';

	// The draft pretends the game is live at move 142: you can step back
	// through it and return to the current move, like on a real live board.
	const LIVE_MOVE = 142;
	const curve = sampleCurve(LIVE_MOVE);
	let move = $state(LIVE_MOVE);
	let position = $derived(finalPosition(move));
	let streamLoaded = $state(false);
</script>

<svelte:head>
	<title>Live – GoTV</title>
</svelte:head>

<section class="stage" aria-label="Übertragung">
	<div class="main-column">
		<div class="video panel">
			{#if streamLoaded}
				<div class="video-frame">
					<p>Hier läuft der Player der EGF.</p>
				</div>
			{:else}
				<div class="video-frame">
					<p class="live"><span class="dot" aria-hidden="true"></span>Läuft gerade</p>
					<h1>Europameisterschaft 2026</h1>
					<p class="who">Finale: Andrii Kravets gegen Ali Jabarin</p>
					<button class="button button-primary" onclick={() => (streamLoaded = true)}>
						Stream laden
					</button>
					<p class="privacy">Erst dann verbindet sich GoTV mit Twitch.</p>
				</div>
			{/if}
		</div>

		<section class="next" aria-labelledby="next-title">
			<h2 id="next-title" class="panel-title">Als Nächstes</h2>
			<ul>
				{#each upcoming as item (item.id)}
					<li>
						<time datetime={item.day}>
							{new Date(item.day).toLocaleDateString('de-DE', {
								weekday: 'short',
								day: 'numeric',
								month: 'short'
							})}
							<span>{item.time}</span>
						</time>
						<div>
							<strong>{item.title}</strong>
							<span class="muted">{item.detail}</span>
						</div>
						<span class="where">{item.where}</span>
						<button
							class="star"
							class:on={item.starred}
							aria-pressed={item.starred}
							aria-label="{item.title} merken"
						>
							{item.starred ? '★' : '☆'}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<div class="board-panel panel">
		<PlayerBar color="white" name="Ali Jabarin" rank="3p" clock="0:41" />
		<Board
			board={position.board}
			lastMove={position.lastMove}
			label="Partie Kravets gegen Jabarin nach Zug {move}"
		/>
		<PlayerBar color="black" name="Andrii Kravets" rank="3p" clock="1:12" toMove />
		<BoardNav bind:move total={LIVE_MOVE} latest={LIVE_MOVE} />
		<div class="move-line">
			{#if move < LIVE_MOVE}
				<span>Zug {move}, live ist Zug {LIVE_MOVE}</span>
				<button class="link" onclick={() => (move = LIVE_MOVE)}>Zum aktuellen Zug</button>
			{:else}
				<span>Zug {move}</span>
				<span class="muted">OGS, live verbunden</span>
			{/if}
		</div>
		<WinCurve values={curve} current={move} onmove={(m: number) => (move = m)} />
	</div>
</section>

<style>
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr);
		gap: var(--gap);
		align-items: start;
	}

	.video {
		background: var(--stage);
		color: var(--stage-ink);
		border-color: var(--stage);
	}

	.video-frame {
		aspect-ratio: 16 / 9;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		gap: 10px;
		padding: clamp(20px, 4vw, 44px);
	}

	.video-frame h1 {
		margin: 0;
		font-size: clamp(1.6rem, 3.4vw, 2.6rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
		font-weight: 700;
		max-width: 16ch;
	}

	.video-frame p {
		margin: 0;
	}

	.who {
		opacity: 0.8;
		font-size: 1.05rem;
	}

	.live {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #7fd3b2;
		box-shadow: 0 0 0 4px rgba(127, 211, 178, 0.25);
	}

	.privacy {
		font-size: 0.85em;
		opacity: 0.65;
	}

	.board-panel {
		padding: 10px 14px 14px;
	}

	.move-line {
		display: flex;
		justify-content: space-between;
		padding: 6px 2px 10px;
		font-size: 0.9em;
	}

	.main-column {
		display: flex;
		flex-direction: column;
		gap: calc(var(--gap) * 1.2);
		min-width: 0;
	}

	.link {
		border: 0;
		padding: 0;
		background: none;
		color: var(--accent);
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.next .panel-title {
		padding-left: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 16px;
		padding: 12px 0;
		border-bottom: 1px solid var(--rule);
	}

	li div {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	time {
		display: flex;
		flex-direction: column;
		font-weight: 600;
	}

	time span {
		font-weight: 400;
		color: var(--ink-soft);
	}

	.where {
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.star {
		border: 0;
		background: none;
		font-size: 1.3rem;
		color: var(--ink-soft);
		cursor: pointer;
		padding: 4px 6px;
	}

	.star.on {
		color: #c8962b;
	}

	/* Oldschool: framed windows, a black video area, a list like a table */
	:global([data-design='oldschool']) .stage {
		grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
	}

	:global([data-design='oldschool']) .video-frame {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	:global([data-design='oldschool']) .video-frame h1 {
		font-size: 20px;
		max-width: none;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .dot {
		background: var(--live);
		box-shadow: none;
		border-radius: 0;
	}

	:global([data-design='oldschool']) .board-panel {
		padding: 4px;
	}

	:global([data-design='oldschool']) .next {
		background: var(--surface);
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .next .panel-title {
		padding-left: 6px;
	}

	:global([data-design='oldschool']) li {
		padding: 4px 6px;
		gap: 10px;
		background: var(--surface-sunk);
		border-bottom: 1px solid #d4d0c8;
	}

	@media (max-width: 900px) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
		}

		/* Portrait: video, then the board, then what comes next */
		.main-column {
			display: contents;
		}

		.next {
			order: 3;
		}

		.board-panel {
			max-width: 640px;
			width: 100%;
			justify-self: center;
		}
	}

	@media (max-width: 560px) {
		li {
			grid-template-columns: 5.5rem minmax(0, 1fr) auto;
		}

		.where {
			display: none;
		}
	}
</style>
