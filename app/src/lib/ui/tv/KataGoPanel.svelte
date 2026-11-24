<script lang="ts">
	// KataGo on request while replaying: off by default, so no evaluation
	// shows unless the viewer asks ("ohne ständig eingeblendete Bewertung").
	import { onDestroy, untrack } from 'svelte';
	import {
		compareGameMove,
		DEFAULT_VISITS,
		formatPoint,
		findMistakes,
		getGameNextMove,
		getKataGoEngine,
		getPvPoints,
		VERIFY_CANDIDATES
	} from '#lib/model/KataGoEngine.ts';
	import type {
		GameMistake,
		KataGoAnalysis,
		KataGoMove,
		PositionEval
	} from '#lib/model/KataGoEngine.ts';
	import { getBranchPoint, getMainLine } from '#lib/model/ReplayVariation.ts';
	import { errorMessage } from '#lib/util/error.ts';
	import type { GameTree } from '#lib/model/types.ts';
	import GameGraph from './GameGraph.svelte';

	let {
		tree,
		nodeId,
		onMoves,
		onJump,
		onLayLine
	}: {
		tree: GameTree;
		nodeId: number;
		// Top moves for the board labels (null: none to show).
		onMoves: (nodeId: number, moves: Array<KataGoMove> | null) => unknown;
		// Shows a position of the game (curve and mistake list).
		onJump?: (nodeId: number) => unknown;
		// "Variante legen": KataGo's expected line into the game tree.
		onLayLine?: (points: Array<{ x: number; y: number }>, comment: string) => unknown;
	} = $props();

	type GameStatus = 'idle' | 'running' | 'ready' | 'error';
	type GameState = {
		status: GameStatus;
		// running: "curve" (network) or "check" (search on the candidates)
		step: 'curve' | 'check';
		done: number;
		total: number;
		evals: Array<PositionEval>;
		mistakes: Array<GameMistake>;
		error: string | null;
	};

	const NO_GAME: GameState = {
		status: 'idle',
		step: 'curve',
		done: 0,
		total: 0,
		evals: [],
		mistakes: [],
		error: null
	};

	// How many moves of the expected line the list spells out.
	const PV_SHOWN = 6;
	const ENABLED_KEY = 'gotv.katago';
	// The mistake list: losses from this size, at most this many.
	const MIN_MISTAKE_POINTS = 2;
	const SHOWN_MISTAKES = 5;
	const VISIT_OPTIONS = [50, 100, 400, 1000];
	// Wait for the viewer to stop clicking through moves before analysing.
	const DEBOUNCE_MS = 250;

	function formatPercent(value: number): string {
		return String(Math.round(value * 100)) + ' %';
	}

	function formatPoints(value: number): string {
		return Math.abs(value).toLocaleString('de-DE', {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		});
	}

	function formatLead(lead: number): string {
		if (Math.abs(lead) < 0.05) return 'ausgeglichen';
		return (lead > 0 ? 'Schwarz' : 'Weiß') + ' führt mit ' + formatPoints(lead) + ' Punkten';
	}

	function loadEnabled(): boolean {
		try {
			return window.localStorage.getItem(ENABLED_KEY) === '1';
		} catch {
			return false;
		}
	}

	function getBoardSize(t: GameTree, id: number): number {
		return t.computedState[id]?.board.length ?? 19;
	}

	let enabled = $state(loadEnabled());
	let status = $state<'idle' | 'running' | 'ready' | 'error'>('idle');
	let analysis = $state.raw<KataGoAnalysis | null>(null);
	let analysedNode = $state<number | null>(null);
	let error = $state<string | null>(null);
	let visits = $state(DEFAULT_VISITS);
	let modelName = $state<string | null>(null);
	let game = $state.raw<GameState>(NO_GAME);

	let timer: ReturnType<typeof setTimeout> | null = null;
	let mounted = true;
	let stopGame = false;
	let fileUrl: string | null = null;

	function schedule() {
		if (timer) clearTimeout(timer);
		onMoves(nodeId, null);
		timer = setTimeout(analyze, DEBOUNCE_MS);
	}

	function analyze() {
		const asked = nodeId;
		status = 'running';
		error = null;
		getKataGoEngine()
			.analyze(tree, asked, visits)
			.then((result) => {
				if (!mounted || asked !== nodeId) return;
				status = 'ready';
				analysis = result;
				analysedNode = asked;
				onMoves(asked, result.moves);
			})
			.catch((err: unknown) => {
				const message = errorMessage(err);
				if (!mounted || message === 'canceled') return;
				status = 'error';
				error = message;
			});
	}

	// Analyse whenever the shown position (or the settings) change while on.
	let rootNode = $derived(tree.rootNode);
	$effect(() => {
		if (!enabled) return;
		void nodeId;
		void rootNode;
		void visits;
		void modelName;
		untrack(schedule);
	});

	onDestroy(() => {
		mounted = false;
		stopGame = true;
		if (timer) clearTimeout(timer);
		getKataGoEngine().cancel();
	});

	function onToggle() {
		const next = !enabled;
		try {
			window.localStorage.setItem(ENABLED_KEY, next ? '1' : '0');
		} catch {
			// not remembered
		}
		enabled = next;
		analysis = null;
		status = 'idle';
		if (!next) {
			if (timer) clearTimeout(timer);
			getKataGoEngine().cancel();
			onMoves(nodeId, null);
		}
	}

	function onChangeVisits(event: Event) {
		visits = Number((event.currentTarget as HTMLSelectElement).value) || DEFAULT_VISITS;
	}

	// A stronger KataGo net from disk (e.g. the b18 net of KaTrain). It stays
	// in this browser tab; nothing is uploaded anywhere.
	function onChooseModel(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (fileUrl) URL.revokeObjectURL(fileUrl);
		fileUrl = URL.createObjectURL(file);
		getKataGoEngine().setModelUrl(fileUrl);
		modelName = file.name;
	}

	function layLine(move: KataGoMove) {
		if (!onLayLine) return;
		const size = getBoardSize(tree, nodeId);
		onLayLine(
			getPvPoints(move, size),
			'KataGo-Variante: ' +
				formatPoint(move.x, move.y, size) +
				' · Schwarz ' +
				formatPercent(move.winRate) +
				' · ' +
				formatLead(move.scoreLead)
		);
	}

	// 1. every position from the network alone (seconds), 2. the most
	// suspicious moves again with a real search, because the network alone
	// swings in ko fights - only losses that hold up are listed.
	async function evaluateGame() {
		const evaluated = tree;
		const engine = getKataGoEngine();
		const stop = () => stopGame || !mounted;
		const progress = (step: 'curve' | 'check') => (done: number, total: number) => {
			if (mounted) game = { ...game, step, done, total };
		};
		stopGame = false;
		game = { ...NO_GAME, status: 'running', step: 'curve' };
		try {
			const evals = await engine.evaluateGame(evaluated, progress('curve'), stop);
			if (!evals) {
				if (mounted) game = NO_GAME;
				return;
			}
			game = { ...game, evals, step: 'check', done: 0 };
			const candidates = findMistakes(evals, evaluated, VERIFY_CANDIDATES);
			const verified = await engine.verifyMistakes(evaluated, candidates, progress('check'), stop);
			if (!verified || !mounted) {
				if (mounted) game = NO_GAME;
				return;
			}
			const mistakes = verified
				.filter((mistake) => mistake.pointsLost >= MIN_MISTAKE_POINTS)
				.slice(0, SHOWN_MISTAKES); // keeps the win-chance order
			game = { ...NO_GAME, status: 'ready', evals, mistakes };
		} catch (err) {
			if (mounted) game = { ...NO_GAME, status: 'error', error: errorMessage(err) };
		}
	}

	let currentMove = $derived.by(() => {
		const branch = getBranchPoint(tree, nodeId);
		return Math.max(0, getMainLine(tree).indexOf(typeof branch === 'number' ? branch : nodeId));
	});

	let size = $derived(getBoardSize(tree, nodeId));
	let gameMove = $derived(
		analysis && analysedNode === nodeId ? getGameNextMove(tree, nodeId) : null
	);
	let comparison = $derived(analysis && gameMove ? compareGameMove(analysis, gameMove) : null);
	let compareText = $derived.by(() => {
		if (!analysis || !gameMove) return null;
		const played = formatPoint(gameMove.x, gameMove.y, size);
		if (!comparison) return 'Die Partie spielte ' + played + ' – auch KataGos erste Wahl.';
		const best = formatPoint(comparison.best.x, comparison.best.y, size);
		if (comparison.played) {
			return (
				'Die Partie spielte ' +
				played +
				': laut KataGo ' +
				formatPoints(comparison.played.pointsLost) +
				' Punkte schlechter als ' +
				best +
				'.'
			);
		}
		return (
			'Die Partie spielte ' +
			played +
			' – nicht unter KataGos ' +
			String(analysis.moves.length) +
			' besten Zügen; KataGo bevorzugt ' +
			best +
			'.'
		);
	});
</script>

<section class="katago panel" aria-label="KataGo-Analyse">
	<div class="header">
		<label class="switch">
			<input type="checkbox" checked={enabled} onchange={onToggle} />
			<strong>KataGo-Analyse</strong>
		</label>
		{#if enabled}
			<span class="options">
				<label>
					Visits
					<select value={visits} onchange={onChangeVisits}>
						{#each VISIT_OPTIONS as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
				<span class="model">
					Netz: {modelName || 'klein (b6, mitgeliefert)'}
					<label class="small-button file-button">
						Stärkeres Netz laden …
						<input type="file" accept=".gz,.bin" class="file-input" onchange={onChooseModel} />
					</label>
				</span>
			</span>
		{:else}
			<span class="muted hint">
				rechnet im Browser, nichts wird verschickt; zeigt Bewertung und bessere Züge erst nach dem
				Einschalten
			</span>
		{/if}
	</div>

	{#if enabled}
		<div class="body">
			{#if game.status === 'running'}
				<p class="game" role="status">
					{game.step === 'curve'
						? 'Partie wird ausgewertet … Zug ' +
							String(game.done) +
							' von ' +
							(game.total ? String(game.total) : '?')
						: 'Auffällige Züge werden mit KataGo-Suche geprüft … ' +
							String(game.done) +
							' von ' +
							(game.total ? String(game.total) : '?')}
					<button type="button" class="link" onclick={() => (stopGame = true)}>Abbrechen</button>
				</p>
			{:else if game.status === 'ready' && onJump}
				<GameGraph {tree} evals={game.evals} mistakes={game.mistakes} {currentMove} {onJump} />
			{:else}
				<p class="game">
					<button type="button" class="small-button" onclick={evaluateGame}>
						Ganze Partie auswerten
					</button>
					<span class="muted">
						{game.status === 'error'
							? 'Auswertung fehlgeschlagen: ' + (game.error || '')
							: 'Gewinnkurve und die größten Fehler; zeigt den Partieverlauf'}
					</span>
				</p>
			{/if}

			{#if status === 'error'}
				<p class="error" role="alert">
					KataGo konnte nicht rechnen: {error || 'unbekannter Fehler'}
				</p>
			{:else if !analysis || analysedNode !== nodeId}
				<p class="muted running" role="status">
					KataGo rechnet … (beim ersten Mal wird das Netz geladen)
				</p>
			{:else}
				<div class="position">
					<p class="summary">
						Gewinnchance Schwarz {formatPercent(analysis.winRate)} · {formatLead(
							analysis.scoreLead
						)}
						<span class="muted meta">
							({analysis.visits} Visits{analysis.backend
								? ', ' + analysis.backend.toUpperCase()
								: ''})
						</span>
					</p>
					<ol class="moves">
						{#each analysis.moves as move, index (move.x + '-' + move.y)}
							<li>
								<span class="badge" aria-hidden="true">{index + 1}</span>
								<span class="move-text">
									<strong>{formatPoint(move.x, move.y, size)}</strong> · Schwarz {formatPercent(
										move.winRate
									)} · {move.scoreLead >= 0 ? '+' : '−'}{formatPoints(move.scoreLead)} · {move.visits}
									Visits
									{#if move.pv.length > 1}
										<span class="muted pv">
											· erwartet {move.pv.slice(0, PV_SHOWN).join(' ')}{move.pv.length > PV_SHOWN
												? ' …'
												: ''}
										</span>
									{/if}
								</span>
								{#if onLayLine}
									<button type="button" class="small-button lay" onclick={() => layLine(move)}>
										Variante legen
									</button>
								{/if}
							</li>
						{/each}
					</ol>
					{#if compareText}
						<p class="compare">{compareText}</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.katago {
		padding: 12px 16px;
	}

	.header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 1.05em;
		cursor: pointer;
	}

	.switch input {
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--accent);
	}

	.options {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
	}

	.model {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.hint {
		font-size: 0.9em;
	}

	.small-button {
		display: inline-flex;
		align-items: center;
		padding: 4px 12px;
		border: var(--button-border);
		border-radius: var(--radius-pill);
		background: var(--button-bg);
		color: var(--ink);
		font-size: 0.9em;
		cursor: pointer;
		white-space: nowrap;
	}

	/* The native file field stays usable (keyboard, screen readers) but
	   invisible inside its button. */
	.file-button {
		position: relative;
		overflow: hidden;
	}

	.file-button:focus-within {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.file-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.body p {
		margin: 10px 0 0;
	}

	.game {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
	}

	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
	}

	.error {
		color: var(--danger, #b3261e);
	}

	.summary {
		font-weight: 650;
	}

	.meta {
		font-weight: normal;
	}

	.moves {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}

	.moves li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
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
		padding: 10px 12px;
		border-radius: var(--radius-s);
		background: var(--accent-soft);
	}

	:global([data-design='oldschool']) .katago {
		padding: 6px;
	}

	:global([data-design='oldschool']) .badge {
		border-radius: 0;
	}

	:global([data-design='oldschool']) .moves li {
		padding: 3px 0;
		border-top-color: #b9b3a5;
	}

	:global([data-design='oldschool']) .compare {
		border: 1px solid #808080;
		background: var(--warn-bg, #ffffe1);
	}

	:global([data-design='oldschool']) .small-button {
		padding: 2px 8px;
	}
</style>
