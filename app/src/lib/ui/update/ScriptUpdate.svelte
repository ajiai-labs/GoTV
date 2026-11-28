<script lang="ts">
	// "Nach Updates suchen" for the script installation (Linux, from the
	// GoTV folder): the local GoTV service fetches from GitHub, and on
	// "Jetzt aktualisieren" pulls, builds and installs; the page shows the
	// installed and the new version, the steps as a bar, and reloads at the
	// end (user, 28.11.2026). Nothing that cuts the KGS connection while your
	// own game runs: no update, no restart of the service, no reload - he
	// plays in GoTV while it updates and tests its stability that way.
	import { onDestroy, onMount } from 'svelte';
	import { t, language, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { app } from '#lib/app.svelte.ts';
	import { hasOwnRunningGame } from '#lib/model/game/ownGame.ts';
	import {
		BUILD_VERSION,
		requestScriptUpdate,
		versionName,
		type ScriptUpdatePhase,
		type ScriptUpdateStatus,
		type ScriptVersion
	} from '#lib/model/scriptUpdate.ts';
	import ScriptChanges from './ScriptChanges.svelte';

	const POLL_MS = 2000;
	// After a restart of the service: first try to reach it again.
	const RESTART_WAIT_MS = 4000;
	const STEPS: Array<{ phase: ScriptUpdatePhase; name: MessageKey }> = [
		{ phase: 'pull', name: 'app.update.stepPull' },
		{ phase: 'build', name: 'app.update.stepBuild' },
		{ phase: 'install', name: 'app.update.stepInstall' }
	];

	let {
		fetchFn = fetch,
		reload = () => window.location.reload(),
		pollMs = POLL_MS,
		playing,
		installed = BUILD_VERSION
	}: {
		fetchFn?: typeof fetch;
		reload?: () => void;
		// Shorter in tests.
		pollMs?: number;
		// Your own game runs (tests; otherwise from the KGS state).
		playing?: boolean;
		// The version of this page (tests; otherwise from the build).
		installed?: ScriptVersion | null;
	} = $props();

	let ownGame = $derived(playing ?? hasOwnRunningGame(app.state));
	let status = $state<ScriptUpdateStatus | null>(null);
	let busy = $state<'check' | 'run' | null>(null);
	let unreachable = $state(false);
	let restarting = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const ERRORS: Partial<Record<string, MessageKey>> = {
		noGit: 'app.update.scriptNoGit',
		noUpstream: 'app.update.scriptNoGit',
		fetchFailed: 'app.update.error',
		dirty: 'app.update.scriptDirty',
		pullFailed: 'app.update.scriptPullFailed',
		installFailed: 'app.update.scriptInstallFailed',
		timeout: 'app.update.scriptTimeout'
	};

	async function call(action: 'status' | 'check' | 'run') {
		try {
			status = await requestScriptUpdate(action, fetchFn);
			unreachable = false;
		} catch {
			// An older service without the update, or none at all.
			if (action !== 'status') unreachable = true;
			return;
		}
		follow();
	}

	function follow() {
		if (timer) clearTimeout(timer);
		timer = null;
		if (status?.state === 'running') {
			timer = setTimeout(() => void call('status'), pollMs);
		} else if (status?.state === 'done' && status.restart && !ownGame) {
			void restartService();
		}
	}

	// The service starts itself again, then the page reloads. An older
	// service has restarted by itself already (it knows no "restart").
	async function restartService() {
		if (restarting) return;
		restarting = true;
		try {
			await requestScriptUpdate('restart', fetchFn);
		} catch {
			// older service: restarting on its own
		}
		timer = setTimeout(() => void waitForRestart(), Math.min(RESTART_WAIT_MS, pollMs * 2));
	}

	async function waitForRestart() {
		try {
			await requestScriptUpdate('status', fetchFn);
			reload();
		} catch {
			timer = setTimeout(() => void waitForRestart(), pollMs);
		}
	}

	// A restart that waited for the end of your game.
	$effect(() => {
		if (!ownGame && status?.state === 'done' && status.restart) void restartService();
	});

	async function run(action: 'check' | 'run') {
		busy = action;
		await call(action);
		busy = null;
	}

	onMount(() => {
		// An update started earlier (e.g. before a reload) is shown.
		void call('status');
	});
	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});

	function formatDate(iso: string): string {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return iso;
		return date.toLocaleString(language.current === 'en' ? 'en-GB' : 'de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function versionLine(version: ScriptVersion): string {
		return t('app.update.versionLine', {
			name: versionName(version).name,
			date: formatDate(version.date),
			commit: version.commit
		});
	}

	let error = $derived.by(() => {
		if (!status) return null;
		if (status.dirty) return ERRORS.dirty ?? null;
		const key = status.error ? ERRORS[status.error] : undefined;
		return key ?? null;
	});
	let canRun = $derived(
		!!status && status.state !== 'running' && !status.dirty && !!status.behind && !error
	);
	let mine = $derived(installed ?? status?.current ?? null);
	let mineName = $derived(mine ? versionName(mine) : null);
	let stepIndex = $derived(
		status?.state === 'running'
			? STEPS.findIndex((step) => step.phase === (status?.phase ?? 'pull'))
			: -1
	);
</script>

<p>{t('app.update.script')}</p>
{#if mine && mineName}
	<p class="ScriptUpdate-version">
		{t('app.update.yourVersion', { version: versionLine(mine) })}
		{#if mineName.base && mineName.count}
			<span class="muted ScriptUpdate-hint">
				{t('app.update.versionHint', { count: String(mineName.count), base: mineName.base })}
			</span>
		{/if}
	</p>
{/if}
<div class="ScriptUpdate-row">
	<button
		type="button"
		class="button"
		disabled={busy !== null || status?.state === 'running' || restarting}
		onclick={() => run('check')}
	>
		{t('app.update.check')}
	</button>
	{#if canRun}
		<button
			type="button"
			class="button button-primary"
			disabled={busy !== null || ownGame}
			onclick={() => run('run')}
		>
			{t('app.update.scriptRun')}
		</button>
	{/if}
</div>
{#if canRun && status?.target}
	<p class="ScriptUpdate-version">
		{t('app.update.newVersion', { version: versionLine(status.target) })}
	</p>
	<ScriptChanges subjects={status.changes} />
{/if}
{#if canRun && ownGame}
	<p class="ScriptUpdate-playing">{t('app.update.scriptPlaying')}</p>
{/if}
{#if stepIndex >= 0 && status}
	<div class="ScriptUpdate-progress">
		{#if status.target}
			<p>{t('app.update.installing', { version: versionLine(status.target) })}</p>
		{/if}
		<progress max={STEPS.length} value={stepIndex + 0.5} aria-label={t('app.update.scriptRun')}
		></progress>
		<ol class="ScriptUpdate-steps">
			{#each STEPS as step, i (step.phase)}
				<li class:done={i < stepIndex} class:current={i === stepIndex}>
					{i < stepIndex ? '✓' : i === stepIndex ? '▸' : '·'}
					{t(step.name)}
				</li>
			{/each}
		</ol>
		<p class="muted" role="status">
			{t('app.update.step', { n: String(stepIndex + 1), name: t(STEPS[stepIndex].name) })}
		</p>
	</div>
{/if}
<div class="ScriptUpdate-status" role="status">
	{#if busy === 'check'}
		{t('app.update.checking')}
	{:else if unreachable}
		{t('app.update.scriptServer')}
	{:else if restarting}
		{t('app.update.scriptRestarting')}
	{:else if status?.state === 'running'}
		{t('app.update.scriptRunning')}
	{:else if status?.state === 'done' && status.restart && ownGame}
		{t('app.update.scriptWaitGame')}
	{:else if status?.state === 'done'}
		<span>{t('app.update.scriptDone')}</span>
		<button type="button" class="button" disabled={ownGame} onclick={reload}>
			{t('app.update.scriptReload')}
		</button>
		{#if ownGame}
			<span>{t('app.update.scriptReloadLater')}</span>
		{/if}
	{:else if error}
		{t(error)}
	{:else if status && status.behind !== null && busy === null && status.behind > 0}
		{t('app.update.scriptAvailable', { count: status.behind })}
	{:else if status && status.behind === 0}
		{t('app.update.upToDate')}
	{/if}
</div>
{#if status?.state === 'failed' && status.log.length}
	<details class="ScriptUpdate-log">
		<summary>{t('app.update.scriptDetails')}</summary>
		<pre>{status.log.join('\n')}</pre>
	</details>
{/if}

<style>
	.ScriptUpdate-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.ScriptUpdate-status {
		color: var(--ink-soft);
	}

	.ScriptUpdate-status:empty {
		display: none;
	}

	.ScriptUpdate-version {
		margin: 0;
	}

	.ScriptUpdate-hint {
		display: block;
		font-size: 0.85rem;
	}

	.ScriptUpdate-playing {
		margin: 0;
		color: var(--danger, #b3261e);
	}

	.ScriptUpdate-progress {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ScriptUpdate-progress p {
		margin: 0;
	}

	.ScriptUpdate-progress progress {
		width: 100%;
		height: 0.75rem;
		accent-color: var(--accent);
	}

	.ScriptUpdate-steps {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--ink-soft);
	}

	.ScriptUpdate-steps .done {
		color: var(--accent);
	}

	.ScriptUpdate-steps .current {
		color: var(--ink);
		font-weight: 600;
	}

	.ScriptUpdate-log pre {
		max-height: 14rem;
		overflow: auto;
		font-size: 0.8rem;
		white-space: pre-wrap;
	}
</style>
