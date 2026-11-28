<script lang="ts">
	// "Neue Videos der Kanäle" on the Kanäle tab (28.11.2026): the newest
	// videos of the YouTube channels - round recordings, lectures, announced
	// live streams - from the channels' official feeds (events.json
	// "videos"). A click opens the video right here behind the usual two-
	// click placeholder (nothing from YouTube loads before), or on YouTube.
	import { getRecentVideos } from '#lib/model/tv.ts';
	import type { TvChannel, TvVideo } from '#lib/model/tv.ts';
	import { locale, t } from '#lib/i18n/index.svelte.ts';
	import StreamEmbed from './StreamEmbed.svelte';

	let {
		videos,
		channels,
		now
	}: { videos: Array<TvVideo>; channels: Array<TvChannel>; now: number } = $props();

	let recent = $derived(getRecentVideos(videos, channels, new Date(now)));
	let openId: string | null = $state(null);

	function watchUrl(videoId: string): string {
		return 'https://www.youtube.com/watch?v=' + videoId;
	}

	function formatDay(iso: string): string {
		return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
	}
</script>

{#if recent.length}
	<section class="ChannelVideos" aria-labelledby="channel-videos-title">
		<h2 id="channel-videos-title" class="ChannelVideos-title">{t('tv.videos.title')}</h2>
		<ul class="ChannelVideos-list">
			{#each recent as video (video.videoId)}
				<li class="ChannelVideos-item">
					<button
						type="button"
						class="ChannelVideos-open"
						aria-expanded={openId === video.videoId}
						onclick={() => (openId = openId === video.videoId ? null : video.videoId)}
					>
						<span class="ChannelVideos-video-title">{video.title}</span>
						<span class="ChannelVideos-meta">
							{video.channelName} · {formatDay(video.published)}
						</span>
					</button>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- YouTube, not a GoTV page -->
					<a
						class="ChannelVideos-external"
						href={watchUrl(video.videoId)}
						target="_blank"
						rel="noopener noreferrer"
					>
						{t('tv.videos.onYouTube')}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{#if openId === video.videoId}
						<div class="ChannelVideos-player">
							<StreamEmbed url={watchUrl(video.videoId)} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.ChannelVideos {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ChannelVideos-title {
		margin: 0;
		font-size: 1.15rem;
	}

	.ChannelVideos-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ChannelVideos-item {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 6px 12px;
		padding: 8px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
	}

	.ChannelVideos-open {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.ChannelVideos-video-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}

	.ChannelVideos-open:hover .ChannelVideos-video-title {
		color: var(--accent);
	}

	.ChannelVideos-meta {
		color: var(--ink-soft);
		font-size: 0.85em;
	}

	.ChannelVideos-external {
		font-size: 0.85em;
		white-space: nowrap;
	}

	.ChannelVideos-player {
		grid-column: 1 / -1;
	}
</style>
