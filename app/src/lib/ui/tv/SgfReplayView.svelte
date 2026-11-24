<script module lang="ts">
	// OGS writes chat lines it cannot serialise as "name: [object Object]" into
	// its SGF export; those lines carry no text and are left out.
	const BROKEN_CHAT_LINE_RE = /\[object Object\]\s*$/;

	export function getReadableComment(text: unknown): string | null {
		if (typeof text !== 'string') return null;
		const lines = text
			.split(/\r?\n/)
			.filter((line) => line.trim() && !BROKEN_CHAT_LINE_RE.test(line));
		return lines.length ? lines.join('\n') : null;
	}
</script>

<script lang="ts">
	// Replays a game: from an address, a file, pasted SGF text or a game
	// already in memory (a KGS game watched to the end). Own moves become side
	// branches, KataGo helps on request, the place, bookmarks and variations
	// are remembered per game. `compact`: board and navigation only (Live).
	import { untrack } from 'svelte';
	import Board from '#lib/ui/Board.svelte';
	import BoardNav from '#lib/ui/BoardNav.svelte';
	import { config } from '#lib/config.ts';
	import { parseSgf, SgfParseError, getSgfPlayerNames, getSgfRootProp } from '#lib/model/sgf.ts';
	import { computeGameNodeStates, getGameLine } from '#lib/model/game/tree.ts';
	import {
		applyVariationEntries,
		getBranchPoint,
		getColorToPlay,
		getContinuations,
		getMainLine,
		getMoveError,
		getNodeMove,
		getVariationEntries,
		playVariationLine,
		playVariationMove,
		removeVariation,
		returnToGame,
		showContinuation
	} from '#lib/model/ReplayVariation.ts';
	import { formatPoint } from '#lib/model/KataGoEngine.ts';
	import type { KataGoMove } from '#lib/model/KataGoEngine.ts';
	import {
		addReplayBookmark,
		getSgfTextKey,
		loadReplayProgress,
		removeReplayBookmark,
		saveReplayMove,
		saveReplayVariations
	} from '#lib/model/ReplayProgress.ts';
	import type { ReplayBookmark } from '#lib/model/ReplayProgress.ts';
	import { getSgfFileName, writeSgf } from '#lib/model/SgfWriter.ts';
	import type { GameTree, PlayerColor, Point, SgfProp } from '#lib/model/types.ts';
	import KataGoPanel from './KataGoPanel.svelte';

	let {
		initialUrl = null,
		initialTree = null,
		replayKey = null,
		compact = false
	}: {
		initialUrl?: string | null;
		initialTree?: GameTree | null;
		// Remembers progress and bookmarks of an initialTree game (e.g. a KGS
		// game id); an URL or pasted text names itself.
		replayKey?: string | null;
		compact?: boolean;
	} = $props();

	const MOVE_NOTICE: Record<string, string | null> = {
		ko: 'Ko: sofort zurückschlagen ist verboten – erst woanders spielen.',
		suicide: 'Selbstmord: Der Stein hätte keine Freiheit.',
		occupied: null // a click on a stone just does nothing
	};

	const COLOR_LABEL = { black: 'Schwarz', white: 'Weiß' } as const;

	const CORS_ERROR_MESSAGE =
		'SGF konnte nicht geladen werden. Wahrscheinlich blockiert der Server ' +
		'direkte Anfragen (CORS). Lade die Datei direkt hoch oder füge den SGF-Text ein.';

	let status = $state<'empty' | 'ready' | 'error'>('empty');
	let error = $state<string | null>(null);
	let tree = $state.raw<GameTree | null>(null);
	let currentNode = $state(0);
	let input = $state('');
	// "Nachspielen fortsetzen" (not in compact views).
	let progressKey = $state<string | null>(null);
	let progressUrl = $state<string | null>(null);
	let resumedFrom = $state<number | null>(null);
	let bookmarks = $state.raw<Array<ReplayBookmark>>([]);
	// Text of a bookmark being written; null while the field is closed.
	let bookmarkDraft = $state<string | null>(null);
	// KataGo's top moves for the shown position, as board labels 1-5.
	let kataGoMoves = $state.raw<{ nodeId: number; moves: Array<KataGoMove> } | null>(null);
	// Why the last click on the board was not played (ko, suicide).
	let moveNotice = $state<string | null>(null);

	const uid = $props.id();
	let loadCount = 0;
	let prevTree: GameTree | null | undefined;
	let prevUrl: string | null | undefined;

	// Opens initialTree / initialUrl at the start and whenever one changes.
	$effect(() => {
		const nextTree = initialTree;
		const nextUrl = initialUrl;
		untrack(() => {
			if (nextTree && nextTree !== prevTree) {
				applyTree(nextTree);
			} else if (nextUrl && nextUrl !== prevUrl) {
				loadUrl(nextUrl);
			}
			prevTree = nextTree;
			prevUrl = nextUrl;
		});
	});

	// Root-relative addresses of bundled files ("/tv/demo.sgf") live under
	// the base path of the app (GitHub Pages: /GoTV).
	function resolveSgfUrl(url: string): string {
		const base = config.basePath;
		if (!base || !url.startsWith('/') || url.startsWith('//') || url.startsWith(base + '/')) {
			return url;
		}
		return base + url;
	}

	function getTitle(t: GameTree): string {
		const names = getSgfPlayerNames(t);
		return names.black && names.white ? names.black + ' – ' + names.white : 'SGF-Partie';
	}

	// A tree that's already in memory (e.g. a game just watched to the end) -
	// no fetch, no SGF (re-)parsing. Always starts the replay at the root,
	// regardless of where the live view's currentNode happened to be.
	function applyTree(t: GameTree) {
		loadCount++;
		showTree(t, replayKey ? 'game:' + replayKey : null, null);
	}

	// Opens a parsed game, at the move where the viewer stopped last time.
	function showTree(parsed: GameTree, key: string | null, url: string | null) {
		const progress = key && !compact ? loadReplayProgress(key) : null;
		let opened = parsed;
		if (progress?.variations?.length) {
			// Own and KataGo variations from last time.
			opened = applyVariationEntries(opened, progress.variations);
		}
		const mainLine = getMainLine(opened);
		const resumeMove =
			progress && progress.move > 0 && progress.move < mainLine.length ? progress.move : null;
		let node = opened.rootNode;
		let shown = { ...opened, currentNode: node, currentLine: getGameLine(opened, node) };
		if (resumeMove) {
			node = mainLine[resumeMove];
			shown = {
				...opened,
				computedState: computeGameNodeStates(opened, node),
				currentLine: mainLine,
				currentNode: node
			};
		} else if (!shown.computedState[node]) {
			shown.computedState = computeGameNodeStates(shown, node);
		}
		status = 'ready';
		error = null;
		tree = shown;
		currentNode = node;
		progressKey = compact ? null : key;
		progressUrl = url;
		resumedFrom = resumeMove;
		bookmarks = progress ? progress.bookmarks : [];
		bookmarkDraft = null;
		kataGoMoves = null;
		moveNotice = null;
		// A game from an address goes straight into "Zuletzt nachgespielt",
		// so it can be found again (also offline) before a move was played.
		if (key && url && !compact) {
			saveReplayMove(key, resumeMove || 0, getTitle(shown), url);
		}
	}

	function loadUrl(url: string) {
		const count = ++loadCount;
		status = 'empty';
		error = null;
		fetch(resolveSgfUrl(url))
			.then((res) => {
				if (!res.ok) throw new Error('HTTP ' + String(res.status));
				return res.text();
			})
			.then((text) => {
				if (count === loadCount) loadSgf(text, url);
			})
			.catch((err: unknown) => {
				console.warn('[tv] Failed to load SGF from ' + url + ':', err);
				if (count !== loadCount) return;
				status = 'error';
				error = compact
					? 'Finalpartie konnte nicht geladen werden. Schließe das Beispiel und öffne es erneut.'
					: CORS_ERROR_MESSAGE;
			});
	}

	function loadSgf(text: string, url?: string | null) {
		let parsed: GameTree;
		try {
			parsed = parseSgf(text);
		} catch (err) {
			if (err instanceof SgfParseError) {
				status = 'error';
				error = 'SGF konnte nicht gelesen werden: ' + err.message;
				tree = null;
				return;
			}
			throw err;
		}
		showTree(parsed, url ? 'url:' + url : getSgfTextKey(text), url ?? null);
	}

	// Remembers the move on the game itself (inside a variation: where the
	// variation left the game).
	function saveProgress(t: GameTree, nodeId: number) {
		if (!progressKey) return;
		const mainLine = getMainLine(t);
		const branch = getBranchPoint(t, nodeId);
		const move = mainLine.indexOf(typeof branch === 'number' ? branch : nodeId);
		saveReplayMove(progressKey, Math.max(0, move), getTitle(t), progressUrl);
	}

	function saveVariations(t: GameTree) {
		if (progressKey) saveReplayVariations(progressKey, getVariationEntries(t));
	}

	function changeCurrentNode(nodeId: number) {
		if (!tree) return;
		const next: GameTree = { ...tree };
		if (!next.computedState[nodeId]) {
			next.computedState = computeGameNodeStates(next, nodeId);
		}
		if (!next.currentLine.includes(nodeId)) {
			next.currentLine = getGameLine(next, nodeId);
		}
		next.currentNode = nodeId;
		tree = next;
		currentNode = nodeId;
		moveNotice = null;
		saveProgress(next, nodeId);
	}

	// A click on an empty point plays an own move (a side branch).
	function onClickPoint(loc: Point, color: PlayerColor | null) {
		if (!tree || color) return;
		const played = playVariationMove(tree, currentNode, loc);
		if (played) {
			tree = played.tree;
			currentNode = played.nodeId;
			moveNotice = null;
			saveProgress(played.tree, played.nodeId);
			saveVariations(played.tree);
		} else {
			const moveError = getMoveError(tree, currentNode, loc);
			moveNotice = moveError ? MOVE_NOTICE[moveError] : null;
		}
	}

	function onReturnToGame() {
		if (!tree) return;
		const back = returnToGame(tree, currentNode);
		if (!back.computedState[back.currentNode]) {
			back.computedState = computeGameNodeStates(back, back.currentNode);
		}
		tree = back;
		currentNode = back.currentNode;
	}

	function onRemoveVariation() {
		if (!tree) return;
		const next = removeVariation(tree, currentNode);
		if (!next.computedState[next.currentNode]) {
			next.computedState = computeGameNodeStates(next, next.currentNode);
		}
		tree = next;
		currentNode = next.currentNode;
		kataGoMoves = null;
		saveVariations(next);
	}

	function onShowContinuation(nodeId: number) {
		if (!tree) return;
		const next = showContinuation(tree, nodeId);
		tree = next;
		currentNode = next.currentNode;
		saveProgress(next, next.currentNode);
	}

	// KataGo's expected line as a variation, shown from its first move: the
	// normal move buttons then step through it.
	function onLayLine(points: Array<{ x: number; y: number }>, comment: string) {
		if (!tree) return;
		const laid = playVariationLine(tree, currentNode, points, comment);
		if (laid) {
			tree = laid.tree;
			currentNode = laid.firstNodeId;
			saveProgress(laid.tree, laid.firstNodeId);
			saveVariations(laid.tree);
		}
	}

	function onKataGoMoves(nodeId: number, moves: Array<KataGoMove> | null) {
		kataGoMoves = moves ? { nodeId, moves } : null;
	}

	// The game with all variations and comments as a file to keep or to open
	// in another Go program.
	function onExportSgf() {
		if (!tree) return;
		const blob = new Blob([writeSgf(tree)], { type: 'application/x-go-sgf' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = getSgfFileName(tree);
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function onRestart() {
		if (!tree) return;
		resumedFrom = null;
		changeCurrentNode(tree.rootNode);
	}

	function onJumpToBookmark(move: number) {
		const nodeId = tree ? getMainLine(tree)[move] : undefined;
		if (typeof nodeId === 'number') changeCurrentNode(nodeId);
	}

	function onRemoveBookmark(move: number) {
		if (progressKey) bookmarks = removeReplayBookmark(progressKey, move);
	}

	function onSaveBookmark(event: SubmitEvent) {
		event.preventDefault();
		if (!tree || !progressKey) return;
		const mainLine = getMainLine(tree);
		const branch = getBranchPoint(tree, currentNode);
		const move = mainLine.indexOf(typeof branch === 'number' ? branch : currentNode);
		saveProgress(tree, currentNode);
		bookmarks = addReplayBookmark(progressKey, move, bookmarkDraft || '');
		bookmarkDraft = null;
	}

	function onFileChange(event: Event) {
		const field = event.currentTarget as HTMLInputElement;
		const file = field.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			loadSgf(typeof reader.result === 'string' ? reader.result : '');
		};
		reader.readAsText(file);
		// Reset so selecting the same file again triggers onchange again
		field.value = '';
	}

	let line = $derived(tree ? tree.currentLine : []);
	let moveNum = $derived(line.indexOf(currentNode));
	let computed = $derived(tree ? tree.computedState[currentNode] : null);
	let playerNames = $derived(tree ? getSgfPlayerNames(tree) : { black: null, white: null });
	let result = $derived(tree ? getSgfRootProp(tree, 'RE') : null);
	let boardSize = $derived.by(() => {
		// The RULES prop carries board size beyond the SgfProp type
		const rules: (SgfProp & { size?: unknown }) | undefined = tree?.nodes[tree.rootNode].props.find(
			(p) => p.name === 'RULES'
		);
		return rules && typeof rules.size === 'number' ? String(rules.size) : '?';
	});
	let mainLine = $derived(tree ? getMainLine(tree) : []);
	let branchPoint = $derived(tree ? getBranchPoint(tree, currentNode) : null);
	let comment = $derived.by(() => {
		const prop = tree?.nodes[currentNode]?.props.find((p) => p.name === 'COMMENT');
		return prop ? getReadableComment(prop.text) : null;
	});
	// The result only at the game's last move - replaying must not be
	// spoiled, and an own variation's end is no game end.
	let showResult = $derived(!!result && currentNode === mainLine[mainLine.length - 1]);
	// KataGo's candidates as labels 1-5 on empty points (the tree itself
	// keeps its own markup).
	let labels = $derived.by(() => {
		if (!computed || !kataGoMoves || kataGoMoves.nodeId !== currentNode) return [];
		const board = computed.board;
		return kataGoMoves.moves.flatMap((move, index) =>
			board[move.y] && !board[move.y][move.x]
				? [{ x: move.x, y: move.y, text: String(index + 1) }]
				: []
		);
	});
	let continuations = $derived.by(() => {
		if (!tree) return [];
		const t = tree;
		const size = t.computedState[currentNode]?.board.length ?? 19;
		const shownNext = t.currentLine[t.currentLine.indexOf(currentNode) + 1];
		return getContinuations(t, currentNode).map((continuation) => {
			const move = getNodeMove(t, continuation.nodeId);
			const point = move ? formatPoint(move.x, move.y, size) : 'Passen';
			const label = continuation.isGame
				? 'Partie ' + point
				: (continuation.comment?.startsWith('KataGo') ? 'KataGo ' : 'Variante ') + point;
			return { nodeId: continuation.nodeId, label, shown: continuation.nodeId === shownNext };
		});
	});
	let boardLabel = $derived(
		(playerNames.black && playerNames.white
			? playerNames.black + ' gegen ' + playerNames.white + ', '
			: '') +
			'Brett nach Zug ' +
			String(moveNum)
	);
</script>

{#snippet info()}
	<p class="info">
		{#if playerNames.black && playerNames.white}
			<span class="player">
				<span class="stone black" aria-hidden="true"></span>{playerNames.black}
				<span class="muted">(Schwarz)</span>
			</span>
			<span>gegen</span>
			<span class="player">
				<span class="stone white" aria-hidden="true"></span>{playerNames.white}
				<span class="muted">(Weiß)</span>
			</span>
		{/if}
		<span class="game-meta">
			{#if showResult}
				<span class="result">· {result}</span>
			{/if}
			<span class="muted">· {boardSize}×{boardSize}</span>
		</span>
	</p>
{/snippet}

{#snippet captures()}
	{#if computed}
		<p class="captures muted">
			Zug {moveNum} · Gefangene: Schwarz {computed.blackCaptures}, Weiß {computed.whiteCaptures}
		</p>
	{/if}
{/snippet}

{#snippet navigation()}
	{#if moveNotice}
		<p class="move-notice" role="status">{moveNotice}</p>
	{/if}
	{#if tree && typeof branchPoint === 'number'}
		<div class="variation">
			<span>
				Variante ab Zug {mainLine.indexOf(branchPoint)} · {COLOR_LABEL[
					getColorToPlay(tree, currentNode)
				]} ist am Zug
			</span>
			<button type="button" class="small-button" onclick={onReturnToGame}>
				Zurück zur Partie
			</button>
			<button type="button" class="link" onclick={onRemoveVariation}>Variante löschen</button>
		</div>
	{/if}
	{#if continuations.length}
		<div class="continuations">
			<span class="muted">Weiter mit:</span>
			{#each continuations as continuation (continuation.nodeId)}
				<button
					type="button"
					class="chip"
					class:shown={continuation.shown}
					aria-pressed={continuation.shown}
					onclick={() => onShowContinuation(continuation.nodeId)}
				>
					{continuation.label}
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet commentBox()}
	{#if comment}
		<div class="comment">
			<div class="comment-title">Kommentar:</div>
			<div class="comment-text">{comment}</div>
		</div>
	{/if}
{/snippet}

{#snippet progress()}
	<div class="progress">
		{#if resumedFrom}
			<p class="resumed muted">
				Weiter bei Zug {resumedFrom} – hier hast du zuletzt aufgehört.
				<button type="button" class="link" onclick={onRestart}>Von vorn</button>
			</p>
		{/if}
		{#if bookmarks.length}
			<ul class="bookmarks" aria-label="Lesezeichen">
				{#each bookmarks as bookmark (bookmark.move)}
					<li class="bookmark">
						<button
							type="button"
							class="bookmark-jump"
							onclick={() => onJumpToBookmark(bookmark.move)}
						>
							Zug {bookmark.move}{bookmark.note ? ': ' + bookmark.note : ''}
						</button>
						<button
							type="button"
							class="bookmark-remove"
							aria-label={'Lesezeichen bei Zug ' + String(bookmark.move) + ' löschen'}
							onclick={() => onRemoveBookmark(bookmark.move)}
						>
							×
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="progress-actions">
			<button type="button" class="small-button" onclick={onExportSgf}>Als SGF speichern</button>
			{#if bookmarkDraft === null}
				<button
					type="button"
					class="small-button"
					disabled={moveNum < 1}
					onclick={() => (bookmarkDraft = '')}
				>
					Lesezeichen bei Zug {moveNum}
				</button>
			{/if}
		</div>
		{#if bookmarkDraft !== null}
			<form class="bookmark-form" onsubmit={onSaveBookmark}>
				<input
					type="text"
					class="bookmark-input"
					value={bookmarkDraft}
					maxlength={200}
					placeholder="z. B. Hier verstehe ich den Kampf nicht"
					aria-label={'Notiz zu Zug ' + String(moveNum)}
					oninput={(e) => (bookmarkDraft = e.currentTarget.value)}
				/>
				<button type="submit" class="small-button">Speichern</button>
				<button type="button" class="link" onclick={() => (bookmarkDraft = null)}>Abbrechen</button>
			</form>
		{/if}
	</div>
{/snippet}

{#snippet sources()}
	<section class="sources panel" aria-labelledby="{uid}-sources">
		<h2 id="{uid}-sources" class="panel-title">
			{status === 'ready' ? 'Andere Partie laden' : 'Partie laden'}
		</h2>
		<div class="sources-body">
			<label class="source">
				<span class="source-label">SGF-Datei:</span>
				<input
					type="file"
					accept=".sgf,.SGF,text/plain,application/x-go-sgf"
					onchange={onFileChange}
				/>
			</label>
			<div class="source">
				<label class="source-label" for="{uid}-paste">SGF einfügen:</label>
				<textarea id="{uid}-paste" bind:value={input} placeholder="(;GM[1]SZ[19]...)" rows="3"
				></textarea>
				<div>
					<button
						type="button"
						class="small-button"
						disabled={!input.trim()}
						onclick={() => loadSgf(input)}
					>
						Laden
					</button>
				</div>
			</div>
		</div>
	</section>
{/snippet}

<div class="replay" class:compact>
	{#if compact && status === 'empty'}
		<p class="notice muted" role="status">Finalpartie wird geladen …</p>
	{/if}
	{#if status === 'error'}
		<p class="error" role="alert">{error || 'Unbekannter Fehler'}</p>
	{/if}

	{#if status === 'ready' && tree && computed}
		<div class="game">
			<div class="board-side" class:panel={!compact}>
				{#if compact}
					{@render info()}
				{/if}
				<Board
					board={computed.board}
					markup={computed.markup}
					{labels}
					label={boardLabel}
					onpoint={onClickPoint}
				/>
				<BoardNav
					bind:move={() => moveNum, (move: number) => changeCurrentNode(line[move])}
					total={Math.max(0, line.length - 1)}
				/>
				{#if compact}
					{@render captures()}
				{/if}
			</div>

			{#if compact}
				{@render navigation()}
				{@render commentBox()}
			{:else}
				<div class="side">
					<header class="head">
						{@render info()}
						{@render captures()}
					</header>
					{@render navigation()}
					{#key progressKey || 'replay'}
						<KataGoPanel
							{tree}
							nodeId={currentNode}
							onMoves={onKataGoMoves}
							{onLayLine}
							onJump={changeCurrentNode}
						/>
					{/key}
					{#if progressKey}
						{@render progress()}
					{/if}
					{@render commentBox()}
					{@render sources()}
				</div>
			{/if}
		</div>
	{:else if !compact}
		{@render sources()}
	{/if}
</div>

<style>
	.replay {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.replay.compact {
		gap: 8px;
	}

	.game {
		display: grid;
		/* The board column never gets taller than the screen (iPad landscape). */
		grid-template-columns: minmax(0, max(340px, calc(100dvh - 230px))) minmax(300px, 1fr);
		gap: var(--gap);
		align-items: start;
	}

	.compact .game {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.board-side {
		min-width: 0;
	}

	.board-side.panel {
		padding: 10px 14px 14px;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}

	.head p {
		margin: 0;
	}

	.info {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 8px;
	}

	.side .info {
		font-size: clamp(1.1rem, 1.8vw, 1.45rem);
		font-weight: 650;
		line-height: 1.2;
	}

	.side .info .muted {
		font-weight: 400;
	}

	.player,
	.game-meta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.stone {
		display: inline-block;
		width: 0.8em;
		height: 0.8em;
		border-radius: 50%;
	}

	.stone.black {
		background: radial-gradient(circle at 35% 30%, #4a524e, #0c0e0d 70%);
	}

	.stone.white {
		background: radial-gradient(circle at 35% 30%, #ffffff, #d5dbd4 80%);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
	}

	.captures {
		margin: 4px 0 0;
		font-size: 0.9em;
	}

	.notice,
	.error {
		margin: 0;
	}

	.error {
		padding: 10px 12px;
		border-left: 4px solid #c4302b;
		border-radius: var(--radius-s);
		background: #fdf0ef;
		color: #5c1512;
	}

	.move-notice {
		margin: 0;
		padding: 8px 12px;
		border-left: 4px solid #c4302b;
		border-radius: var(--radius-s);
		background: #fdf0ef;
		color: #5c1512;
	}

	.variation {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		padding: 8px 12px;
		border-left: 4px solid var(--accent);
		border-radius: var(--radius-s);
		background: var(--accent-soft);
	}

	.continuations {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.chip {
		padding: 4px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-pill);
		background: var(--surface);
		cursor: pointer;
	}

	.chip.shown {
		border-color: var(--accent);
		background: var(--accent-soft);
		font-weight: 650;
	}

	.small-button {
		display: inline-flex;
		align-items: center;
		padding: 5px 12px;
		border: var(--button-border);
		border-radius: var(--radius-pill);
		background: var(--button-bg);
		color: var(--ink);
		font-size: 0.92em;
		cursor: pointer;
		white-space: nowrap;
	}

	.small-button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
	}

	.progress {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.resumed {
		margin: 0;
	}

	.bookmarks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.bookmark {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--rule);
		border-radius: var(--radius-pill);
		background: var(--surface);
	}

	.bookmark-jump,
	.bookmark-remove {
		padding: 4px 10px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
	}

	.bookmark-remove {
		padding: 4px 10px 4px 2px;
		color: var(--ink-soft);
	}

	.progress-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.bookmark-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.bookmark-input {
		flex: 1 1 220px;
		min-width: 0;
		padding: 6px 8px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}

	.comment {
		padding: 10px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
	}

	.comment-title {
		font-weight: 650;
		margin-bottom: 4px;
	}

	.comment-text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		max-height: 16em;
		overflow-y: auto;
	}

	.sources-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 16px 16px;
	}

	.source {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.source-label {
		font-weight: 650;
	}

	.source input[type='file'] {
		max-width: 100%;
	}

	textarea {
		width: 100%;
		min-height: 4.5em;
		padding: 6px 8px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
		resize: vertical;
	}

	:global([data-design='oldschool']) .board-side.panel {
		padding: 4px;
	}

	:global([data-design='oldschool']) .side .info {
		font-size: 16px;
	}

	:global([data-design='oldschool']) .side {
		gap: 8px;
	}

	:global([data-design='oldschool']) .variation,
	:global([data-design='oldschool']) .move-notice,
	:global([data-design='oldschool']) .error {
		border-radius: 0;
	}

	:global([data-design='oldschool']) .comment {
		border: 2px inset #ece9e2;
		border-radius: 0;
		background: #ffffff;
	}

	:global([data-design='oldschool']) .chip,
	:global([data-design='oldschool']) .bookmark {
		border-radius: 2px;
	}

	:global([data-design='oldschool']) .chip.shown {
		border: 1px solid var(--accent);
	}

	:global([data-design='oldschool']) .small-button {
		padding: 2px 8px;
	}

	:global([data-design='oldschool']) .sources-body {
		padding: 6px;
	}

	:global([data-design='oldschool']) textarea,
	:global([data-design='oldschool']) .bookmark-input {
		border: 2px inset #ece9e2;
		border-radius: 0;
		background: #ffffff;
	}

	@media (max-width: 900px) {
		.game {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
