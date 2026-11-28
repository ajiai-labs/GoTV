<script lang="ts">
	// "Über GoTV" in the settings: which GoTV runs and, in the desktop apps,
	// "Nach Updates suchen" with the result (same state as the notice).
	import { t } from '#lib/i18n/index.svelte.ts';
	import { config, isDesktop } from '#lib/config.ts';
	import { DESKTOP_VERSION } from '#lib/desktopUpdate.ts';
	import { desktopUpdate } from './desktopUpdate.svelte.ts';
	import UpdateDownloads from './UpdateDownloads.svelte';
	import ScriptUpdate from './ScriptUpdate.svelte';

	let {
		version = DESKTOP_VERSION,
		kind = version ? 'desktop' : config.guestOnly ? 'web' : isDesktop() ? 'script' : 'web',
		fetchFn = fetch
	}: {
		version?: string | null;
		kind?: 'desktop' | 'script' | 'web';
		fetchFn?: typeof fetch;
	} = $props();
</script>

<section id="ueber-gotv" class="AboutGoTv" aria-labelledby="about-title">
	<h2 id="about-title" class="panel-title">{t('app.update.about')}</h2>
	{#if kind === 'desktop' && version}
		<p>{t('app.update.version', { version })}</p>
		<div class="AboutGoTv-check">
			<button
				type="button"
				class="button"
				disabled={desktopUpdate.status === 'checking'}
				onclick={() => desktopUpdate.check(version, fetchFn)}
			>
				{t('app.update.check')}
			</button>
			<span class="AboutGoTv-status" role="status">
				{#if desktopUpdate.status === 'checking'}
					{t('app.update.checking')}
				{:else if desktopUpdate.status === 'upToDate'}
					{t('app.update.upToDate')}
				{:else if desktopUpdate.status === 'error'}
					{t('app.update.error')}
				{:else if desktopUpdate.status === 'available'}
					{t('app.update.available', { version: desktopUpdate.latest ?? '' })}
				{/if}
			</span>
		</div>
		{#if desktopUpdate.status === 'available'}
			<UpdateDownloads {fetchFn} />
		{/if}
	{:else if kind === 'script'}
		<ScriptUpdate {fetchFn} />
	{:else}
		<p>{t('app.update.web')}</p>
	{/if}
	<h3 class="AboutGoTv-sub">{t('app.update.sources')}</h3>
	<p class="muted">{t('app.update.sourcesText')}</p>
	<p class="muted">{t('app.update.noAiTraining')}</p>
</section>

<style>
	.AboutGoTv {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.AboutGoTv .panel-title {
		padding-left: 0;
	}

	.AboutGoTv-sub {
		margin: 6px 0 0;
		font-size: 0.95rem;
	}

	.AboutGoTv p {
		margin: 0;
	}

	.AboutGoTv-check {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
	}

	.AboutGoTv-status {
		color: var(--ink-soft);
	}
</style>
