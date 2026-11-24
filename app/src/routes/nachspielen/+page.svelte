<script lang="ts">
	// Nachspielen (draft): the board large, beside it moves, KataGo and the curve.
	import Board from '#lib/ui/Board.svelte';
	import PlayerBar from '#lib/ui/PlayerBar.svelte';
	import WinCurve from '#lib/ui/WinCurve.svelte';
	import { finalMoveCount, finalPosition, sampleCurve } from '#lib/demo/index.ts';

	const total = finalMoveCount();
	const curve = sampleCurve(total);
	let move = $state(87);
	let position = $derived(finalPosition(move));

	// Draft KataGo suggestions (real ones come from the engine in phase 4):
	// three empty points of the current position, worded from the curve.
	const CANDIDATES = [
		{ x: 15, y: 9 },
		{ x: 13, y: 13 },
		{ x: 5, y: 12 },
		{ x: 14, y: 6 },
		{ x: 9, y: 15 },
		{ x: 3, y: 9 },
		{ x: 10, y: 3 },
		{ x: 16, y: 13 },
		{ x: 6, y: 16 },
		{ x: 11, y: 7 },
		{ x: 2, y: 17 },
		{ x: 17, y: 8 }
	];
	const COLUMNS = 'ABCDEFGHJKLMNOPQRST';
	let black = $derived(Math.round((curve[move] ?? 0.5) * 100));
	let suggestions = $derived(
		CANDIDATES.filter((p) => !position.board[p.y][p.x])
			.slice(0, 3)
			.map((p, i) => ({
				...p,
				text: String(i + 1),
				point: COLUMNS[p.x] + String(19 - p.y),
				black: black - i * 3,
				lead: '+' + ((black - 50) / 5 - i * 0.8).toFixed(1).replace('.', ',')
			}))
	);

	function step(delta: number) {
		move = Math.max(0, Math.min(total, move + delta));
	}
</script>

<svelte:head>
	<title>Nachspielen – GoTV</title>
</svelte:head>

<div class="replay">
	<div class="board-side panel">
		<PlayerBar color="white" name="Ali Jabarin" rank="3p" />
		<Board
			board={position.board}
			lastMove={position.lastMove}
			labels={suggestions}
			label="Europameisterschaft 2026, Finale, nach Zug {move}"
		/>
		<PlayerBar color="black" name="Andrii Kravets" rank="3p" />
		<div class="nav" role="group" aria-label="Züge">
			<button class="button" onclick={() => (move = 0)} aria-label="Zum Anfang">⏮</button>
			<button class="button" onclick={() => step(-1)} aria-label="Ein Zug zurück">◀</button>
			<input type="range" min="0" max={total} bind:value={move} aria-label="Zug wählen" />
			<button class="button" onclick={() => step(1)} aria-label="Ein Zug vor">▶</button>
			<button class="button" onclick={() => (move = total)} aria-label="Zum letzten Zug">⏭</button>
		</div>
	</div>

	<aside class="analysis">
		<header class="game-head">
			<h1>Europameisterschaft 2026, Finale</h1>
			<p class="muted">Kravets gegen Jabarin, Zug {move} von {total}</p>
		</header>

		<section class="panel katago" aria-labelledby="katago-title">
			<h2 id="katago-title" class="panel-title">KataGo</h2>
			<div class="katago-body">
				<p class="verdict">
					{black >= 50 ? 'Schwarz' : 'Weiß'} steht besser, Gewinnchance Schwarz {black} %.
				</p>
				<ol>
					{#each suggestions as s (s.point)}
						<li>
							<span class="badge">{s.text}</span>
							<strong>{s.point}</strong>
							<span class="muted">Schwarz {s.black} %, {s.lead}</span>
							<button class="button">Variante legen</button>
						</li>
					{/each}
				</ol>
				{#if suggestions[0]}
					<p class="compare">
						Die Partie spielte R9, laut KataGo 1,3 Punkte schlechter als {suggestions[0].point}.
					</p>
				{/if}
			</div>
		</section>

		<section class="panel" aria-labelledby="curve-title">
			<h2 id="curve-title" class="panel-title">Partieverlauf</h2>
			<div class="curve-body">
				<WinCurve values={curve} current={move} onmove={(m: number) => (move = m)} />
			</div>
		</section>
	</aside>
</div>

<style>
	.replay {
		display: grid;
		/* The board column never gets taller than the screen (iPad landscape). */
		grid-template-columns: minmax(0, max(340px, calc(100dvh - 250px))) minmax(300px, 1fr);
		gap: var(--gap);
		align-items: start;
	}

	.board-side {
		padding: 10px 14px 14px;
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: 8px;
	}

	.nav input {
		flex: 1;
		accent-color: var(--accent);
		min-width: 0;
	}

	.analysis {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.game-head h1 {
		margin: 0;
		font-size: clamp(1.4rem, 2.4vw, 2rem);
		line-height: 1.1;
		letter-spacing: -0.015em;
	}

	.game-head p {
		margin: 6px 0 0;
	}

	.katago-body,
	.curve-body {
		padding: 4px 16px 16px;
	}

	.verdict {
		margin: 4px 0 12px;
		font-size: 1.1rem;
		font-weight: 600;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	ol li {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--rule);
	}

	.badge {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		font-size: 0.85em;
	}

	.compare {
		margin: 12px 0 0;
		padding: 10px 12px;
		border-radius: var(--radius-s);
		background: var(--accent-soft);
	}

	:global([data-design='oldschool']) .game-head h1 {
		font-size: 16px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .board-side {
		padding: 4px;
	}

	:global([data-design='oldschool']) .katago-body,
	:global([data-design='oldschool']) .curve-body {
		padding: 6px;
	}

	:global([data-design='oldschool']) .verdict {
		font-size: 13px;
	}

	:global([data-design='oldschool']) .badge {
		border-radius: 0;
	}

	:global([data-design='oldschool']) ol li {
		padding: 3px 0;
		border-top-color: #b9b3a5;
	}

	:global([data-design='oldschool']) .compare {
		border: 1px solid #808080;
		background: #ffffe1;
	}

	@media (max-width: 900px) {
		.replay {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
