<script lang="ts">
	// The finished OGS games of a tournament as G1, G2, ... - players and start
	// time only, no result, so nothing is spoiled before replaying. Below the
	// list: all games as one ZIP of SGF files (tournament archive, 28.11.2026).
	import { onMount, untrack } from 'svelte';
	import { ogsTvSource } from '#lib/model/OgsTvSource.ts';
	import type { ReplayGame } from '#lib/model/OgsReplay.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { locale, t } from '#lib/i18n/index.svelte.ts';
	import { buildTournamentArchive } from '#lib/model/tournamentArchive.ts';
	import { formatEventDateRange } from './eventDate.ts';

	let {
		event,
		onOpenReplay,
		defaultOpen = false,
		fetchGames,
		fetchSgf,
		saveFile
	}: {
		event: TvEvent;
		onOpenReplay: (sgfUrl: string) => unknown;
		// Open from the start (Nachspielen tab) instead of behind a button.
		defaultOpen?: boolean;
		// Injected in tests; defaults to the shared OGS source.
		fetchGames?: (event: TvEvent) => Promise<Array<ReplayGame>>;
		// Injected in tests: loading the SGFs and saving the ZIP.
		fetchSgf?: typeof fetch;
		saveFile?: (blob: Blob, fileName: string) => void;
	} = $props();

	type Archive =
		| { state: 'idle' }
		| { state: 'loading'; done: number; total: number }
		| { state: 'done'; missing: Array<number> }
		| { state: 'error' };
	let archive: Archive = $state({ state: 'idle' });

	function saveBlob(blob: Blob, fileName: string) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function listText(lines: Array<string>, missing: Array<number>): string {
		const head = [`${event.name} (${formatEventDateRange(event)})`, t('replay.archive.source'), ''];
		const tail = missing.length
			? ['', t('replay.archive.missingList', { games: missing.map((n) => 'G' + n).join(', ') })]
			: [];
		return [...head, ...lines, ...tail, ''].join('\n');
	}

	async function downloadAll() {
		archive = { state: 'loading', done: 0, total: games.length };
		try {
			const result = await buildTournamentArchive(event, games, {
				fetchFn: fetchSgf,
				onProgress: (done, total) => {
					if (mounted) archive = { state: 'loading', done, total };
				},
				listText
			});
			if (!mounted) return;
			if (result.missing.length === games.length) {
				archive = { state: 'error' };
				return;
			}
			(saveFile ?? saveBlob)(new Blob([result.zip], { type: 'application/zip' }), result.fileName);
			archive = { state: 'done', missing: result.missing };
		} catch {
			if (mounted) archive = { state: 'error' };
		}
	}

	let open = $state(untrack(() => !!defaultOpen));
	let status: 'idle' | 'loading' | 'ready' | 'error' = $state('idle');
	let games: Array<ReplayGame> = $state([]);
	// The reason from OGS; null shows "OGS nicht erreichbar" in the current language.
	let error: string | null = $state(null);
	let mounted = false;

	function formatStart(time: number): string {
		return time
			? new Date(time).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
			: '';
	}

	function load() {
		const fetcher = fetchGames ?? ((e: TvEvent) => ogsTvSource.fetchEventGames(e));
		status = 'loading';
		error = null;
		fetcher(event).then(
			(result) => {
				if (!mounted) return;
				games = result;
				status = 'ready';
			},
			(err: unknown) => {
				if (!mounted) return;
				const message =
					err && typeof err === 'object' && 'message' in err ? String(err.message) : '';
				error = message || null;
				status = 'error';
			}
		);
	}

	function toggle() {
		open = !open;
		if (open && status !== 'ready') load();
	}

	onMount(() => {
		mounted = true;
		if (open) load();
		return () => {
			mounted = false;
		};
	});
</script>

<div class="ReplayGameList">
	<button type="button" class="button ReplayGameList-toggle" aria-expanded={open} onclick={toggle}>
		{open
			? t('replay.games.hide')
			: status === 'ready'
				? t('replay.games.replayCount', { count: games.length })
				: t('replay.games.replay')}
	</button>
	{#if open}
		{#if status === 'loading' || status === 'idle'}
			<p class="ReplayGameList-note" role="status">{t('replay.games.loading')}</p>
		{:else if status === 'error'}
			<p class="ReplayGameList-note ReplayGameList-error" role="alert">
				{t('replay.games.error', { error: error || t('replay.games.ogsUnreachable') })}
				<button type="button" class="ReplayGameList-retry" onclick={load}>
					{t('replay.games.retry')}
				</button>
			</p>
		{:else if !games.length}
			<p class="ReplayGameList-note">{t('replay.games.none')}</p>
		{:else}
			<ol class="ReplayGameList-games">
				{#each games as game, index (game.id)}
					<li>
						<button
							type="button"
							class="ReplayGameList-game"
							onclick={() => onOpenReplay(game.sgfUrl)}
						>
							<span class="ReplayGameList-number">G{index + 1}</span>
							<span class="ReplayGameList-players">● {game.black} – ○ {game.white}</span>
							<span class="ReplayGameList-time">{formatStart(game.started)}</span>
						</button>
					</li>
				{/each}
			</ol>
			<div class="ReplayGameList-archive">
				<button
					type="button"
					class="button"
					disabled={archive.state === 'loading'}
					onclick={() => void downloadAll()}
				>
					{t('replay.archive.download', { count: games.length })}
				</button>
				<span class="ReplayGameList-note" role="status">
					{#if archive.state === 'loading'}
						{t('replay.archive.loading', { done: archive.done, total: archive.total })}
					{:else if archive.state === 'done'}
						{archive.missing.length
							? t('replay.archive.doneMissing', {
									games: archive.missing.map((n) => 'G' + n).join(', ')
								})
							: t('replay.archive.done')}
					{:else if archive.state === 'error'}
						{t('replay.archive.error')}
					{/if}
				</span>
			</div>
		{/if}
	{/if}
</div>

<style>
	.ReplayGameList {
		margin-top: 6px;
	}

	.ReplayGameList-toggle {
		padding: 4px 12px;
		font-size: 0.9em;
	}

	.ReplayGameList-note {
		margin: 0;
		padding: 6px 0;
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.ReplayGameList-error {
		color: var(--danger, #b3261e);
	}

	.ReplayGameList-retry {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
	}

	.ReplayGameList-archive {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		margin-top: 4px;
	}

	.ReplayGameList-archive .button {
		padding: 4px 12px;
		font-size: 0.9em;
	}

	.ReplayGameList-games {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
	}

	.ReplayGameList-game {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 36px;
		margin-bottom: 4px;
		padding: 6px 10px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.ReplayGameList-game:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.ReplayGameList-number {
		min-width: 28px;
		font-weight: 700;
		color: var(--accent);
	}

	.ReplayGameList-players {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ReplayGameList-time {
		color: var(--ink-soft);
		font-size: 0.85em;
		font-variant-numeric: tabular-nums;
	}

	:global([data-design='oldschool']) .ReplayGameList-game {
		border: 2px outset var(--bevel-face, #ece9e2);
		background: var(--button-bg);
	}
</style>
