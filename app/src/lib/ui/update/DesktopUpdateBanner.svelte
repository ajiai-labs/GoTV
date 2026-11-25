<script lang="ts">
	// Desktop apps (Tauri): at start GoTV asks GitHub for the newest release;
	// is it newer, a notice offers the installer. "Später" hides it for this
	// version (gotv.updateDismissed). Nothing in the web version.
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import {
		DESKTOP_VERSION,
		loadDismissedVersion,
		saveDismissedVersion
	} from '#lib/desktopUpdate.ts';
	import { desktopUpdate } from './desktopUpdate.svelte.ts';
	import UpdateDownloads from './UpdateDownloads.svelte';

	let {
		version = DESKTOP_VERSION,
		fetchFn = fetch
	}: { version?: string | null; fetchFn?: typeof fetch } = $props();

	const uid = $props.id();
	let dismissed: string | null = $state(null);

	onMount(() => {
		dismissed = loadDismissedVersion();
		if (version && desktopUpdate.status === 'idle') void desktopUpdate.check(version, fetchFn);
	});

	let visible = $derived(
		!!version && desktopUpdate.status === 'available' && desktopUpdate.latest !== dismissed
	);

	function onLater() {
		if (desktopUpdate.latest) saveDismissedVersion(desktopUpdate.latest);
		dismissed = desktopUpdate.latest;
	}
</script>

{#if visible}
	<aside class="DesktopUpdateBanner panel" aria-labelledby="{uid}-title">
		<div class="DesktopUpdateBanner-body">
			<h2 id="{uid}-title" class="DesktopUpdateBanner-title">
				{t('app.update.available', { version: desktopUpdate.latest ?? '' })}
			</h2>
			<p class="DesktopUpdateBanner-text">
				{t('app.update.current', { version: version ?? '' })}
				{t('app.update.howTo')}
			</p>
			<UpdateDownloads {fetchFn} />
		</div>
		<button type="button" class="button DesktopUpdateBanner-later" onclick={onLater}>
			{t('app.update.later')}
		</button>
	</aside>
{/if}

<style>
	.DesktopUpdateBanner {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px 16px;
		margin: 10px auto 0;
		max-width: 1000px;
		border-left: 4px solid var(--accent);
	}

	.DesktopUpdateBanner-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.DesktopUpdateBanner-title {
		margin: 0;
		font-size: 1.05rem;
	}

	.DesktopUpdateBanner-text {
		margin: 0;
		color: var(--ink-soft);
	}
</style>
