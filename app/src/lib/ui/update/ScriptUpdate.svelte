<script lang="ts">
	// "Nach Updates suchen" for the script installation (Linux, from the
	// GoTV folder): the local GoTV service fetches from GitHub, and on
	// "Jetzt aktualisieren" pulls, builds and installs; the page shows the
	// state and reloads at the end (user, 28.11.2026: an update button like
	// the released app's).
	import { onDestroy, onMount } from 'svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { requestScriptUpdate, type ScriptUpdateStatus } from '#lib/model/scriptUpdate.ts';

	const POLL_MS = 2000;
	// After a restart of the service: first try to reach it again.
	const RESTART_WAIT_MS = 4000;

	let {
		fetchFn = fetch,
		reload = () => window.location.reload(),
		pollMs = POLL_MS
	}: {
		fetchFn?: typeof fetch;
		reload?: () => void;
		// Shorter in tests.
		pollMs?: number;
	} = $props();

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
		} else if (status?.state === 'done' && status.restart) {
			restarting = true;
			timer = setTimeout(() => void waitForRestart(), Math.min(RESTART_WAIT_MS, pollMs * 2));
		}
	}

	async function waitForRestart() {
		try {
			await requestScriptUpdate('status', fetchFn);
			reload();
		} catch {
			timer = setTimeout(() => void waitForRestart(), pollMs);
		}
	}

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

	let error = $derived.by(() => {
		if (!status) return null;
		if (status.dirty) return ERRORS.dirty ?? null;
		const key = status.error ? ERRORS[status.error] : undefined;
		return key ?? null;
	});
	let canRun = $derived(
		!!status && status.state !== 'running' && !status.dirty && !!status.behind && !error
	);
</script>

<p>{t('app.update.script')}</p>
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
			disabled={busy !== null}
			onclick={() => run('run')}
		>
			{t('app.update.scriptRun')}
		</button>
	{/if}
</div>
<div class="ScriptUpdate-status" role="status">
	{#if busy === 'check'}
		{t('app.update.checking')}
	{:else if unreachable}
		{t('app.update.scriptServer')}
	{:else if restarting}
		{t('app.update.scriptRestarting')}
	{:else if status?.state === 'running'}
		{t('app.update.scriptRunning')}
	{:else if status?.state === 'done'}
		<span>{t('app.update.scriptDone')}</span>
		<button type="button" class="button" onclick={reload}>{t('app.update.scriptReload')}</button>
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

	.ScriptUpdate-log pre {
		max-height: 14rem;
		overflow: auto;
		font-size: 0.8rem;
		white-space: pre-wrap;
	}
</style>
