<script lang="ts">
	// "Download the GoTV desktop app" for Windows, macOS and Linux (Tauri
	// builds from GitHub Releases). Shown in the web version, where KGS does
	// not work: the desktop app brings watching, playing and chat on KGS.
	import { t } from '#lib/i18n/index.svelte.ts';
	import {
		DOWNLOADS,
		INSTALL_HELP_URL,
		RELEASES_URL,
		detectOs,
		downloadUrl
	} from '#lib/desktopDownloads.ts';
	import type { DesktopOs } from '#lib/desktopDownloads.ts';

	const os: DesktopOs = typeof navigator === 'undefined' ? 'other' : detectOs(navigator);
	const ORDER: Array<'windows' | 'macos' | 'linux'> = ['windows', 'macos', 'linux'];
	const systems =
		os === 'windows' || os === 'macos' || os === 'linux'
			? [os, ...ORDER.filter((other) => other !== os)]
			: ORDER;
</script>

<section class="downloads" aria-labelledby="downloads-title">
	<h2 id="downloads-title" class="panel-title">{t('app.downloads.title')}</h2>
	<p class="muted">{t('app.downloads.intro')}</p>
	{#if os === 'mobile'}
		<p class="mobile">{t('app.downloads.mobile')}</p>
	{/if}
	<ul>
		{#each systems as system, index (system)}
			<li class:recommended={index === 0 && system === os}>
				<span class="system">{t(`app.downloads.os.${system}`)}</span>
				{#each DOWNLOADS[system] as item (item.file)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- a file on GitHub, outside GoTV -->
					<a
						class="button"
						class:button-primary={index === 0 && system === os && item === DOWNLOADS[system][0]}
						href={downloadUrl(item.file)}
						rel="noopener noreferrer"
					>
						{t(`app.downloads.kind.${item.kind}`)}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/each}
			</li>
		{/each}
	</ul>
	<p class="note muted">
		{t('app.downloads.unsigned')}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a file or page on GitHub, outside GoTV -->
		<a href={INSTALL_HELP_URL} target="_blank" rel="noopener noreferrer">
			{t('app.downloads.help')}
		</a>
		·
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a file or page on GitHub, outside GoTV -->
		<a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
			{t('app.downloads.allVersions')}
		</a>
	</p>
</section>

<style>
	.downloads {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.downloads .panel-title {
		padding-left: 0;
	}

	p {
		margin: 0;
	}

	ul {
		list-style: none;
		margin: 4px 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
	}

	.system {
		min-width: 7rem;
		font-weight: 600;
	}

	.recommended .system::after {
		content: ' ✓';
		color: var(--accent);
	}

	.mobile {
		padding: 8px 10px;
		border-radius: var(--radius-s);
		background: var(--accent-soft);
	}

	.note {
		font-size: 0.85em;
	}
</style>
