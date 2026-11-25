<script lang="ts">
	// The installer buttons of a newer version: the desktop server opens the
	// download in the system browser. If that fails, the release page as a
	// plain address to type in.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { detectOs } from '#lib/desktopDownloads.ts';
	import { openDownload, updateDownloads } from '#lib/desktopUpdate.ts';

	let { fetchFn = fetch }: { fetchFn?: typeof fetch } = $props();

	const os = typeof navigator === 'undefined' ? 'other' : detectOs(navigator);
	const downloads = updateDownloads(os);
	let opened = $state(false);
	let failed = $state(false);

	async function onDownload(file: string) {
		const ok = await openDownload(file, fetchFn);
		opened = ok;
		failed = !ok;
	}
</script>

<div class="UpdateDownloads">
	<div class="UpdateDownloads-buttons">
		{#each downloads as item, index (item.file)}
			<button
				type="button"
				class="button"
				class:button-primary={index === 0}
				onclick={() => onDownload(item.file)}
			>
				{t('app.update.download', { kind: t(`app.downloads.kind.${item.kind}`) })}
			</button>
		{/each}
	</div>
	{#if opened}
		<p class="UpdateDownloads-note" role="status">{t('app.update.opened')}</p>
	{:else if failed}
		<p class="UpdateDownloads-note" role="alert">
			{t('app.update.failed')} <code>github.com/ajiai-labs/GoTV/releases</code>
		</p>
	{/if}
</div>

<style>
	.UpdateDownloads {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.UpdateDownloads-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.UpdateDownloads-note {
		margin: 0;
		color: var(--ink-soft);
	}
</style>
