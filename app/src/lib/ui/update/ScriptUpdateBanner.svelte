<script lang="ts">
	// Script installation (Linux, desktop/install.sh): at start and then every
	// hour the local GoTV service looks on GitHub (the main window asks it to,
	// other windows read its last answer every minute); are there new
	// changes, a notice says so and leads to "Über GoTV", where you start the
	// update yourself (user, 28.11.2026). Also during your own game - then it
	// says to update afterwards. "Später" hides it for that version, in every
	// window.
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { app } from '#lib/app.svelte.ts';
	import { hasOwnRunningGame } from '#lib/model/game/ownGame.ts';
	import {
		describeChanges,
		requestScriptUpdate,
		versionName,
		type ScriptVersion
	} from '#lib/model/scriptUpdate.ts';
	import ScriptChanges from './ScriptChanges.svelte';

	const CHECK_MS = 60 * 60 * 1000;
	const READ_MS = 60 * 1000;
	const DISMISSED_KEY = 'gotv.scriptUpdateDismissed';

	let {
		fetchFn = fetch,
		playing,
		// The main window fetches from GitHub; the others only read.
		fetchesGitHub = true,
		checkMs
	}: {
		fetchFn?: typeof fetch;
		playing?: boolean;
		fetchesGitHub?: boolean;
		checkMs?: number;
	} = $props();

	const uid = $props.id();
	let target = $state<ScriptVersion | null>(null);
	let subjects = $state<Array<string>>([]);
	let dismissed = $state<string | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function check() {
		try {
			const status = await requestScriptUpdate(fetchesGitHub ? 'check' : 'status', fetchFn);
			target = !status.error && !status.dirty && status.behind ? status.target : null;
			subjects = status.changes;
		} catch {
			target = null; // no update service (development, older GoTV)
		}
	}

	onMount(() => {
		try {
			dismissed = localStorage.getItem(DISMISSED_KEY);
		} catch {
			dismissed = null;
		}
		void check();
		timer = setInterval(() => void check(), checkMs ?? (fetchesGitHub ? CHECK_MS : READ_MS));
		window.addEventListener('storage', onStorage);
	});
	onDestroy(() => {
		if (timer) clearInterval(timer);
		window.removeEventListener('storage', onStorage);
	});

	// "Später" in another window hides it here too.
	function onStorage(event: StorageEvent) {
		if (event.key === DISMISSED_KEY) dismissed = event.newValue;
	}

	let ownGame = $derived(playing ?? hasOwnRunningGame(app.state));
	let visible = $derived(!!target && target.commit !== dismissed);
	let counts = $derived.by(() => {
		const changes = describeChanges(subjects);
		const feat = changes.filter((change) => change.kind === 'feat').length;
		const fix = changes.length - feat;
		const parts: Array<string> = [];
		if (feat) parts.push(t('app.update.countFeat', { count: feat }));
		if (fix) parts.push(t('app.update.countFix', { count: fix }));
		return parts.join(', ');
	});

	// To "Über GoTV" in the settings (main window only - a game window
	// stays on its game).
	async function goToAbout() {
		await goto(resolve('/einstellungen'));
		await tick();
		document.getElementById('ueber-gotv')?.scrollIntoView({ block: 'start' });
	}

	function onLater() {
		dismissed = target?.commit ?? null;
		try {
			if (dismissed) localStorage.setItem(DISMISSED_KEY, dismissed);
		} catch {
			// hidden for this session only
		}
	}
</script>

{#if visible && target}
	<aside class="ScriptUpdateBanner panel" aria-labelledby="{uid}-title">
		<div class="ScriptUpdateBanner-body">
			<p id="{uid}-title" class="ScriptUpdateBanner-title">
				{t('app.update.scriptBanner', { version: versionName(target).name })}{#if counts}
					<span class="ScriptUpdateBanner-counts"> · {counts}</span>{/if}
			</p>
			{#if ownGame}
				<p class="ScriptUpdateBanner-later">{t('app.update.scriptBannerAfterGame')}</p>
			{:else}
				<ScriptChanges {subjects} />
			{/if}
		</div>
		{#if !ownGame && fetchesGitHub}
			<button type="button" class="button button-primary" onclick={() => void goToAbout()}>
				{t('app.update.scriptBannerGo')}
			</button>
		{/if}
		<button
			type="button"
			class="button ScriptUpdateBanner-close"
			aria-label={t('app.update.later')}
			title={t('app.update.later')}
			onclick={onLater}
		>
			×
		</button>
	</aside>
{/if}

<style>
	/* One compact line - it must not get in the way of a game. */
	.ScriptUpdateBanner {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 6px 10px;
		margin: 6px auto 0;
		max-width: 1000px;
		padding: 6px 10px;
		border-left: 4px solid var(--accent);
		font-size: 0.9rem;
	}

	.ScriptUpdateBanner-body {
		flex: 1 1 16rem;
		min-width: 0;
	}

	.ScriptUpdateBanner-title {
		margin: 0;
		font-weight: 600;
	}

	.ScriptUpdateBanner-counts {
		font-weight: normal;
		color: var(--ink-soft);
	}

	.ScriptUpdateBanner-later {
		margin: 0;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.ScriptUpdateBanner-close {
		padding: 2px 10px;
	}
</style>
