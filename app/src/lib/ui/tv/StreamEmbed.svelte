<script lang="ts">
	// Two-click embed: nothing external is loaded until the user clicks
	// "Stream laden". If embedding is not possible (a channel URL instead of a
	// video id, embedding switched off), only the external link is offered.
	// "loaded" given: the parent decides (e.g. "Nur Brett" / "Video
	// zuschalten"); otherwise the component remembers the click itself.
	import {
		getEmbedUrlForChannel,
		getEmbedUrlForEvent,
		getStreamUrlInfo,
		hasLinkedBoard,
		hasVideoStream
	} from '#lib/model/tv.ts';
	import type { StreamUrlInfo, TvChannel, TvEvent } from '#lib/model/tv.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	const PLATFORM_LABEL: Record<StreamUrlInfo['platform'], string> = {
		youtube: 'YouTube',
		twitch: 'Twitch',
		other: ''
	};

	let {
		event,
		channel,
		url,
		onLoad,
		loaded
	}: {
		event?: TvEvent;
		channel?: TvChannel;
		url?: string;
		onLoad?: () => unknown;
		loaded?: boolean;
	} = $props();

	let clicked = $state(false);
	let isLoaded = $derived(loaded === undefined ? clicked : loaded);

	let info: StreamUrlInfo = $derived.by(() => {
		const host = window.location.hostname;
		if (url) return getStreamUrlInfo(url, host);
		if (channel) {
			return {
				platform: channel.platform,
				embedUrl: getEmbedUrlForChannel(channel, host),
				externalUrl: channel.url
			};
		}
		if (event) {
			return {
				platform: event.platform,
				embedUrl: getEmbedUrlForEvent(event, host),
				externalUrl: event.stream_url
			};
		}
		return { platform: 'other', embedUrl: null, externalUrl: '' };
	});

	let title = $derived(channel ? channel.name : event ? event.name : url || 'Stream');
	let platformLabel = $derived(PLATFORM_LABEL[info.platform]);
	// A tournament without a stream that is listed for its linked boards.
	let noVideo = $derived(!!event && !hasVideoStream(event) && hasLinkedBoard(event));

	function load() {
		clicked = true;
		onLoad?.();
	}
</script>

{#if !info.embedUrl}
	<div class="StreamEmbed">
		<p class="StreamEmbed-notice">
			{#if noVideo}
				{t('tv.stream.noVideo')}
			{:else if platformLabel}
				{t('tv.stream.cannotEmbedOn', { platform: platformLabel })}
			{:else}
				{t('tv.stream.cannotEmbed')}
			{/if}
		</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the stream's own page, outside GoTV -->
		<a class="button" href={info.externalUrl} target="_blank" rel="noopener noreferrer">
			{noVideo ? t('tv.stream.openTournamentPage') : t('tv.stream.openExternally')}
		</a>
	</div>
{:else if !isLoaded}
	<div class="StreamEmbed StreamEmbed-placeholder">
		<p class="StreamEmbed-placeholder-text">
			{t('tv.stream.placeholder', { platform: platformLabel })}
		</p>
		{#if channel}
			<p class="StreamEmbed-placeholder-hint">
				{t('tv.stream.channelHint')}
			</p>
		{/if}
		<div class="StreamEmbed-actions">
			<button type="button" class="button button-primary" onclick={load}>
				{t('tv.stream.load')}
			</button>
			<!-- A channel card has its own "Auf YouTube/Twitch öffnen". -->
			{#if !channel}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the stream's own page, outside GoTV -->
				<a class="button" href={info.externalUrl} target="_blank" rel="noopener noreferrer">
					{t('tv.stream.openExternally')}
				</a>
			{/if}
		</div>
	</div>
{:else}
	<div class="StreamEmbed">
		<div class="StreamEmbed-frame">
			<iframe
				class="StreamEmbed-iframe"
				src={info.embedUrl}
				{title}
				allow="autoplay; encrypted-media; picture-in-picture"
				allowfullscreen
			></iframe>
		</div>
		<div class="StreamEmbed-external">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- the stream's own page, outside GoTV -->
			<a
				class="StreamEmbed-external-link"
				href={info.externalUrl}
				target="_blank"
				rel="noopener noreferrer"
			>
				{t('tv.stream.openExternally')}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</div>
{/if}

<style>
	.StreamEmbed {
		margin-top: 8px;
	}

	.StreamEmbed-notice {
		margin: 0 0 8px;
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.StreamEmbed-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 20px 16px;
		border-radius: var(--radius-m);
		background: var(--stage);
		color: var(--stage-ink);
		text-align: center;
	}

	.StreamEmbed-placeholder-text,
	.StreamEmbed-placeholder-hint {
		max-width: 44ch;
		margin: 0;
		font-size: 0.9em;
		opacity: 0.85;
	}

	.StreamEmbed-placeholder-hint {
		font-size: 0.82em;
	}

	.StreamEmbed-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}

	.StreamEmbed-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-m);
		background: var(--stage);
		overflow: hidden;
	}

	.StreamEmbed-iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.StreamEmbed-external {
		margin-top: 6px;
		text-align: right;
	}

	.StreamEmbed-external-link {
		font-size: 0.9em;
	}

	:global([data-design='oldschool']) .StreamEmbed-placeholder {
		border: 2px inset #ece9e2;
	}
</style>
