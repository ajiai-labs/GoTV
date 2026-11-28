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
	// "Link kopieren" shares a game from an address at the current move.
	import { onDestroy, tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import Board from '#lib/ui/Board.svelte';
	import BoardNav from '#lib/ui/BoardNav.svelte';
	import Splitter from '#lib/ui/Splitter.svelte';
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
	import { getReplayShareLink } from '#lib/model/ReplayLink.ts';
	import type { GameTree, PlayerColor, Point, SgfProp } from '#lib/model/types.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import KataGoPanel from './KataGoPanel.svelte';
	import ScoreEstimateDialog from '#lib/ui/game/ScoreEstimateDialog.svelte';

	let {
		initialUrl = null,
		initialTree = null,
		replayKey = null,
		initialMove = null,
		kataGo = false,
		kataGoBlocked = false,
		compact = false
	}: {
		initialUrl?: string | null;
		initialTree?: GameTree | null;
		// Remembers progress and bookmarks of an initialTree game (e.g. a KGS
		// game id); an URL or pasted text names itself.
		replayKey?: string | null;
		// Move of the main line to open initialUrl at (a shared link's "zug");
		// wins over "Weiter bei Zug N". Out of range: ignored.
		initialMove?: number | null;
		// KataGo switched on for the first game shown (a KGS game of the
		// viewer, after it ended) - the stored default stays as it is.
		kataGo?: boolean;
		// A local copy of a game still running on KGS: KataGo stays off.
		kataGoBlocked?: boolean;
		compact?: boolean;
	} = $props();

	const MOVE_NOTICE: Record<string, MessageKey | null> = {
		ko: 'replay.view.koNotice',
		suicide: 'replay.view.suicideNotice',
		occupied: null // a click on a stone just does nothing
	};

	const COLOR_LABEL = { black: 'replay.black', white: 'replay.white' } as const;

	// How long "Link kopiert" stays.
	const COPIED_MS = 3000;
	const BOARD_WIDTH_KEY = 'gotv.replayBoardWidth';
	const BOARD_MIN_WIDTH = 320;
	const BOARD_WIDTH_STEP = 24;
	const SIDE_MIN_WIDTH = 300;
	const SPLITTER_WIDTH = 24;

	function loadBoardWidth(): number | null {
		try {
			const width = Number(window.localStorage.getItem(BOARD_WIDTH_KEY));
			return Number.isFinite(width) && width >= BOARD_MIN_WIDTH ? width : null;
		} catch {
			return null;
		}
	}

	let gameEl: HTMLDivElement | undefined = $state();
	let gameWidth = $state(0);
	let windowHeight = $state(0);
	let preferredBoardWidth = $state(untrack(() => (compact ? null : loadBoardWidth())));
	let boardMaxWidth = $derived(
		Math.max(BOARD_MIN_WIDTH, gameWidth - SIDE_MIN_WIDTH - SPLITTER_WIDTH)
	);
	let boardWidth = $derived(
		Math.min(boardMaxWidth, preferredBoardWidth ?? Math.max(BOARD_MIN_WIDTH, windowHeight - 230))
	);

	function setBoardWidth(width: number) {
		preferredBoardWidth = Math.max(BOARD_MIN_WIDTH, Math.min(boardMaxWidth, Math.round(width)));
		try {
			window.localStorage.setItem(BOARD_WIDTH_KEY, String(preferredBoardWidth));
		} catch {
			// not remembered without storage
		}
	}

	function onSplitterPointer(clientX: number) {
		if (gameEl) setBoardWidth(clientX - gameEl.getBoundingClientRect().left - SPLITTER_WIDTH / 2);
	}

	function onSplitterKey(step: -1 | 1 | 'min' | 'max') {
		if (step === 'min') setBoardWidth(BOARD_MIN_WIDTH);
		else if (step === 'max') setBoardWidth(boardMaxWidth);
		else setBoardWidth(boardWidth + step * BOARD_WIDTH_STEP);
	}

	let status = $state<'empty' | 'ready' | 'error'>('empty');
	// The error text, built when shown (it follows a language switch).
	let error = $state<(() => string) | null>(null);
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
	// "Ergebnis schätzen" (as CGoban) for the position shown.
	let estimateShowing = $state(false);
	// Why the last click on the board was not played (ko, suicide).
	let moveNotice = $state<MessageKey | null>(null);
	// Where the shown game came from: only games from an address can be shared.
	let source = $state<'url' | 'text' | 'game' | null>(null);
	// "Link kopieren": copied, or shown in a field to copy by hand.
	let shareState = $state<'idle' | 'copied' | 'manual'>('idle');
	let shareField: HTMLInputElement | undefined = $state();
	// KataGo on for the first game shown (prop kataGo), not for later ones.
	let kataGoStart = $state(false);

	const uid = $props.id();
	let loadCount = 0;
	let prevTree: GameTree | null | undefined;
	let prevUrl: string | null | undefined;
	let initialMoveUsed = false;
	let kataGoUsed = false;
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		if (copiedTimer) clearTimeout(copiedTimer);
	});

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

	function getTitle(game: GameTree): string {
		const names = getSgfPlayerNames(game);
		return names.black && names.white
			? names.black + ' – ' + names.white
			: t('replay.view.untitled');
	}

	// A tree that's already in memory (e.g. a game just watched to the end) -
	// no fetch, no SGF (re-)parsing. Always starts the replay at the root,
	// regardless of where the live view's currentNode happened to be.
	function applyTree(game: GameTree) {
		loadCount++;
		showTree(game, replayKey ? 'game:' + replayKey : null, null, true);
	}

	// The move of a shared link, once, for the game of initialUrl only.
	function takeLinkedMove(url: string | null, moves: number): number | null {
		if (initialMoveUsed || compact) return null;
		// A shared link (initialUrl) or a local copy (initialTree) only.
		if (url ? url !== initialUrl : !initialTree) return null;
		initialMoveUsed = true;
		const move = initialMove;
		return typeof move === 'number' && Number.isInteger(move) && move >= 0 && move < moves
			? move
			: null;
	}

	// Opens a parsed game, at the move of a shared link or where the viewer
	// stopped last time.
	function showTree(parsed: GameTree, key: string | null, url: string | null, fromGame = false) {
		const progress = key && !compact ? loadReplayProgress(key) : null;
		let opened = parsed;
		if (progress?.variations?.length) {
			// Own and KataGo variations from last time.
			opened = applyVariationEntries(opened, progress.variations);
		}
		const mainLine = getMainLine(opened);
		const linkedMove = takeLinkedMove(url, mainLine.length);
		const resumeMove =
			linkedMove === null && progress && progress.move > 0 && progress.move < mainLine.length
				? progress.move
				: null;
		const startMove = linkedMove ?? resumeMove;
		let node = opened.rootNode;
		let shown = { ...opened, currentNode: node, currentLine: getGameLine(opened, node) };
		if (startMove) {
			node = mainLine[startMove];
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
		source = url ? 'url' : fromGame ? 'game' : 'text';
		shareState = 'idle';
		kataGoStart = kataGo && !compact && !kataGoUsed;
		kataGoUsed = true;
		// A game from an address goes straight into "Zuletzt nachgespielt",
		// so it can be found again (also offline) before a move was played.
		if (key && url && !compact) {
			saveReplayMove(key, startMove || 0, getTitle(shown), url);
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
				error = compact ? () => t('replay.view.exampleError') : () => t('replay.view.corsError');
			});
	}

	function loadSgf(text: string, url?: string | null) {
		let parsed: GameTree;
		try {
			parsed = parseSgf(text);
		} catch (err) {
			if (err instanceof SgfParseError) {
				status = 'error';
				const reason = err.message;
				error = () => t('replay.view.parseError', { error: reason });
				tree = null;
				return;
			}
			throw err;
		}
		showTree(parsed, url ? 'url:' + url : getSgfTextKey(text), url ?? null);
	}

	// Remembers the move on the game itself (inside a variation: where the
	// variation left the game).
	function saveProgress(game: GameTree, nodeId: number) {
		if (!progressKey) return;
		const mainLine = getMainLine(game);
		const branch = getBranchPoint(game, nodeId);
		const move = mainLine.indexOf(typeof branch === 'number' ? branch : nodeId);
		saveReplayMove(progressKey, Math.max(0, move), getTitle(game), progressUrl);
	}

	function saveVariations(game: GameTree) {
		if (progressKey) saveReplayVariations(progressKey, getVariationEntries(game));
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

	// Copies the link; without the Clipboard API (or when it is refused) the
	// link appears selected in a read-only field to copy by hand.
	async function onCopyLink() {
		const link = shareLink;
		if (!link) return;
		if (copiedTimer) clearTimeout(copiedTimer);
		try {
			if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('no clipboard');
			await navigator.clipboard.writeText(link);
			shareState = 'copied';
			copiedTimer = setTimeout(() => {
				if (shareState === 'copied') shareState = 'idle';
			}, COPIED_MS);
		} catch {
			shareState = 'manual';
			await tick();
			shareField?.focus();
			shareField?.select();
		}
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
		const game = tree;
		const size = game.computedState[currentNode]?.board.length ?? 19;
		const shownNext = game.currentLine[game.currentLine.indexOf(currentNode) + 1];
		return getContinuations(game, currentNode).map((continuation) => {
			const move = getNodeMove(game, continuation.nodeId);
			const point = move ? formatPoint(move.x, move.y, size) : t('replay.pass');
			// KataGo's lines carry a comment starting with "KataGo" in both languages.
			const label = continuation.isGame
				? t('replay.view.continuationGame', { point })
				: continuation.comment?.startsWith('KataGo')
					? t('replay.view.continuationKataGo', { point })
					: t('replay.view.continuationVariation', { point });
			return { nodeId: continuation.nodeId, label, shown: continuation.nodeId === shownNext };
		});
	});
	// The move of the main line shown (inside a variation: where it left the
	// game) - a shared link opens the game there.
	let linkMove = $derived(
		Math.max(0, mainLine.indexOf(typeof branchPoint === 'number' ? branchPoint : currentNode))
	);
	let shareLink = $derived(
		source === 'url' && progressUrl
			? getReplayShareLink(progressUrl, linkMove, config.basePath)
			: null
	);
	let shareReason = $derived.by((): MessageKey | null => {
		if (shareLink) return null;
		if (source === 'game') return 'replay.view.linkNoKgs';
		if (source === 'url') return 'replay.view.linkNotPublic';
		return 'replay.view.linkNoFile';
	});
	let boardLabel = $derived(
		playerNames.black && playerNames.white
			? t('replay.view.boardLabelPlayers', {
					black: playerNames.black,
					white: playerNames.white,
					move: moveNum
				})
			: t('replay.view.boardLabel', { move: moveNum })
	);
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#snippet info()}
	<p class="info">
		{#if playerNames.black && playerNames.white}
			<span class="player">
				<span class="stone black" aria-hidden="true"></span>{playerNames.black}
				<span class="muted">{t('replay.view.colorInParens', { color: t('replay.black') })}</span>
			</span>
			<span>{t('replay.view.versus')}</span>
			<span class="player">
				<span class="stone white" aria-hidden="true"></span>{playerNames.white}
				<span class="muted">{t('replay.view.colorInParens', { color: t('replay.white') })}</span>
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
			{t('replay.view.captures', {
				move: moveNum,
				black: computed.blackCaptures,
				white: computed.whiteCaptures
			})}
		</p>
	{/if}
{/snippet}

{#snippet navigation()}
	{#if moveNotice}
		<p class="move-notice" role="status">{t(moveNotice)}</p>
	{/if}
	{#if tree && typeof branchPoint === 'number'}
		<div class="variation">
			<span>
				{t('replay.view.variation', {
					move: mainLine.indexOf(branchPoint),
					color: t(COLOR_LABEL[getColorToPlay(tree, currentNode)])
				})}
			</span>
			<button type="button" class="small-button" onclick={onReturnToGame}>
				{t('replay.view.backToGame')}
			</button>
			<button type="button" class="link" onclick={onRemoveVariation}>
				{t('replay.view.removeVariation')}
			</button>
		</div>
	{/if}
	{#if continuations.length}
		<div class="continuations">
			<span class="muted">{t('replay.view.continueWith')}</span>
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
			<div class="comment-title">{t('replay.view.comment')}</div>
			<div class="comment-text">{comment}</div>
		</div>
	{/if}
{/snippet}

{#snippet progress()}
	<div class="progress">
		{#if resumedFrom}
			<p class="resumed muted">
				{t('replay.view.resumed', { move: resumedFrom })}
				<button type="button" class="link" onclick={onRestart}>{t('replay.view.restart')}</button>
			</p>
		{/if}
		{#if bookmarks.length}
			<ul class="bookmarks" aria-label={t('replay.view.bookmarks')}>
				{#each bookmarks as bookmark (bookmark.move)}
					<li class="bookmark">
						<button
							type="button"
							class="bookmark-jump"
							onclick={() => onJumpToBookmark(bookmark.move)}
						>
							{bookmark.note
								? t('replay.view.bookmarkNote', { move: bookmark.move, note: bookmark.note })
								: t('replay.move', { move: bookmark.move })}
						</button>
						<button
							type="button"
							class="bookmark-remove"
							aria-label={t('replay.view.removeBookmark', { move: bookmark.move })}
							onclick={() => onRemoveBookmark(bookmark.move)}
						>
							×
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="progress-actions">
			<button type="button" class="small-button" onclick={() => (estimateShowing = true)}>
				{t('game.estimate.title')}
			</button>
			<!-- A copy of a game still running on KGS: no file or link that could
			     be opened elsewhere with KataGo (no help during a game). -->
			<button
				type="button"
				class="small-button"
				disabled={kataGoBlocked}
				title={kataGoBlocked ? t('replay.view.exportBlocked') : undefined}
				onclick={onExportSgf}
			>
				{t('replay.view.exportSgf')}
			</button>
			<button
				type="button"
				class="small-button"
				disabled={!shareLink || kataGoBlocked}
				title={kataGoBlocked ? t('replay.view.exportBlocked') : undefined}
				aria-describedby={shareReason ? `${uid}-share-reason` : undefined}
				onclick={onCopyLink}
			>
				{t('replay.view.copyLink')}
			</button>
			{#if progressKey && bookmarkDraft === null}
				<button
					type="button"
					class="small-button"
					disabled={moveNum < 1}
					onclick={() => (bookmarkDraft = '')}
				>
					{t('replay.view.addBookmark', { move: moveNum })}
				</button>
			{/if}
		</div>
		{#if shareReason}
			<p id="{uid}-share-reason" class="share-note muted">{t(shareReason)}</p>
		{/if}
		{#if shareState === 'copied'}
			<p class="share-note share-copied" role="status">{t('replay.view.linkCopied')}</p>
		{/if}
		{#if shareState === 'manual' && shareLink}
			<div class="share-manual">
				<input
					bind:this={shareField}
					type="text"
					class="share-field"
					readonly
					value={shareLink}
					aria-label={t('replay.view.linkField', { move: linkMove })}
					onfocus={(e) => e.currentTarget.select()}
				/>
				<p class="muted">{t('replay.view.linkSelect')}</p>
			</div>
		{/if}
		{#if bookmarkDraft !== null}
			<form class="bookmark-form" onsubmit={onSaveBookmark}>
				<input
					type="text"
					class="bookmark-input"
					value={bookmarkDraft}
					maxlength={200}
					placeholder={t('replay.view.notePlaceholder')}
					aria-label={t('replay.view.noteLabel', { move: moveNum })}
					oninput={(e) => (bookmarkDraft = e.currentTarget.value)}
				/>
				<button type="submit" class="small-button">{t('replay.view.save')}</button>
				<button type="button" class="link" onclick={() => (bookmarkDraft = null)}>
					{t('replay.cancel')}
				</button>
			</form>
		{/if}
	</div>
{/snippet}

{#snippet sources()}
	<section class="sources panel" aria-labelledby="{uid}-sources">
		<h2 id="{uid}-sources" class="panel-title">
			{status === 'ready' ? t('replay.view.loadOther') : t('replay.view.load')}
		</h2>
		<div class="sources-body">
			<label class="source">
				<span class="source-label">{t('replay.view.sgfFile')}</span>
				<input
					type="file"
					accept=".sgf,.SGF,text/plain,application/x-go-sgf"
					onchange={onFileChange}
				/>
			</label>
			<div class="source">
				<label class="source-label" for="{uid}-paste">{t('replay.view.pasteSgf')}</label>
				<textarea id="{uid}-paste" bind:value={input} placeholder="(;GM[1]SZ[19]...)" rows="3"
				></textarea>
				<div>
					<button
						type="button"
						class="small-button"
						disabled={!input.trim()}
						onclick={() => loadSgf(input)}
					>
						{t('replay.view.loadButton')}
					</button>
				</div>
			</div>
		</div>
	</section>
{/snippet}

{#snippet board(position: NonNullable<typeof computed>)}
	<div class="board-side" class:panel={!compact}>
		{#if compact}
			{@render info()}
		{/if}
		<Board
			board={position.board}
			markup={position.markup}
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
{/snippet}

<div class="replay" class:compact>
	{#if compact && status === 'empty'}
		<p class="notice muted" role="status">{t('replay.view.loadingExample')}</p>
	{/if}
	{#if status === 'error'}
		<p class="error" role="alert">{error ? error() : t('replay.view.unknownError')}</p>
	{/if}

	{#if status === 'ready' && tree && computed}
		{@const position = computed}
		{#if compact}
			<div class="game">
				{@render board(position)}
				{@render navigation()}
				{@render commentBox()}
			</div>
		{:else}
			{#key progressKey || 'replay'}
				<KataGoPanel
					{tree}
					nodeId={currentNode}
					startEnabled={kataGoStart && !kataGoBlocked}
					blocked={kataGoBlocked}
					onMoves={onKataGoMoves}
					{onLayLine}
					onJump={changeCurrentNode}
				>
					{#snippet layout(controls: Snippet, graph: Snippet)}
						<div
							class="game"
							bind:this={gameEl}
							bind:clientWidth={gameWidth}
							style:--board-width="{boardWidth}px"
							style:--splitter-width="{SPLITTER_WIDTH}px"
						>
							<div class="board-column">
								{@render board(position)}
								{@render graph()}
							</div>
							<div class="board-splitter">
								<Splitter
									label={t('game.screen.splitter')}
									valuenow={boardWidth}
									valuemin={BOARD_MIN_WIDTH}
									valuemax={boardMaxWidth}
									valuetext={t('game.screen.splitterValue', { width: boardWidth })}
									onpointer={onSplitterPointer}
									onkey={onSplitterKey}
								/>
							</div>
							<div class="side">
								<header class="head">
									{@render info()}
									{@render captures()}
								</header>
								{@render navigation()}
								{@render controls()}
								{@render progress()}
								{@render commentBox()}
								{@render sources()}
							</div>
						</div>
					{/snippet}
				</KataGoPanel>
			{/key}
		{/if}
	{:else if !compact}
		{@render sources()}
	{/if}
	{#if estimateShowing && tree}
		<ScoreEstimateDialog
			game={{ tree: { ...tree, currentNode } }}
			onclose={() => (estimateShowing = false)}
		/>
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
		grid-template-columns: minmax(0, var(--board-width)) var(--splitter-width) minmax(0, 1fr);
		align-items: start;
	}

	.board-column {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.board-splitter {
		display: flex;
		justify-content: center;
		/* Keep the grip beside the board even when the analysis makes the page taller. */
		height: min(var(--board-width), 70dvh);
	}

	.compact .game {
		display: flex;
		flex-direction: column;
		/* The board takes the whole column (Kinomodus, splitter), not the
		   width of its content. */
		align-items: stretch;
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
		background: var(--danger-bg, #fdf0ef);
		color: var(--danger-ink, #5c1512);
	}

	.move-notice {
		margin: 0;
		padding: 8px 12px;
		border-left: 4px solid #c4302b;
		border-radius: var(--radius-s);
		background: var(--danger-bg, #fdf0ef);
		color: var(--danger-ink, #5c1512);
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

	.share-note,
	.share-manual p {
		margin: 0;
		font-size: 0.9em;
	}

	.share-copied {
		color: var(--accent);
		font-weight: 650;
	}

	.share-manual {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.share-field {
		width: 100%;
		min-width: 0;
		padding: 6px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: max(16px, 0.9em);
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
		border: 2px inset var(--bevel-face, #ece9e2);
		border-radius: 0;
		background: var(--paper, #ffffff);
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
	:global([data-design='oldschool']) .bookmark-input,
	:global([data-design='oldschool']) .share-field {
		border: 2px inset var(--bevel-face, #ece9e2);
		border-radius: 0;
		background: var(--paper, #ffffff);
	}

	@media (max-width: 900px) {
		.game {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--gap);
		}

		.board-splitter {
			display: none;
		}
	}
</style>
