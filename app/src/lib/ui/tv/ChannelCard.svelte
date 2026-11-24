<script lang="ts">
	// A standing entry on the Kanäle page: always shown, independent of any
	// event date (unlike CalendarEventCard). A channel always has a
	// channel_id, so the two-click embed is always offered.
	import StreamEmbed from './StreamEmbed.svelte';
	import FavoriteStar from './FavoriteStar.svelte';
	import StreamChat from './StreamChat.svelte';
	import { formatChannelSchedule, getChannelLiveUrl } from '#lib/model/tvChannels.ts';
	import { getChannelChat } from '#lib/model/StreamChat.ts';
	import type { TvChannel } from '#lib/model/tv.ts';

	let {
		channel,
		onAir = false,
		favorite = false,
		onToggleFavorite
	}: {
		channel: TvChannel;
		// One of the channel's fixed air times is running right now.
		onAir?: boolean;
		// "Mein GoTV" star; without onToggleFavorite there is no star.
		favorite?: boolean;
		onToggleFavorite?: (channelId: string) => unknown;
	} = $props();

	const PLATFORM_LABEL: Record<TvChannel['platform'], string> = {
		youtube: 'YouTube',
		twitch: 'Twitch'
	};

	let schedule = $derived(formatChannelSchedule(channel));
	let chat = $derived(getChannelChat(channel, window.location.hostname));
	let platformLabel = $derived(PLATFORM_LABEL[channel.platform]);
</script>

<article class="ChannelCard" class:ChannelCard-on-air={onAir}>
	<header class="ChannelCard-header">
		<h3 class="ChannelCard-name">
			{#if onToggleFavorite}
				<FavoriteStar
					active={favorite}
					name={channel.name}
					onToggle={() => onToggleFavorite(channel.id)}
				/>
			{/if}
			<span>{channel.name}</span>
		</h3>
		<span class="ChannelCard-badge ChannelCard-badge-{channel.platform}">{platformLabel}</span>
	</header>
	{#if schedule}
		<p class="ChannelCard-schedule">
			{#if onAir}
				<span class="ChannelCard-live">läuft gerade (geplant)</span>
			{/if}
			Feste Sendezeit: {schedule} (deutsche Zeit)
		</p>
	{/if}
	{#if channel.notes}
		<p class="ChannelCard-notes">{channel.notes}</p>
	{/if}
	<StreamEmbed {channel} />
	<div class="ChannelCard-links">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the channel's own page, outside GoTV -->
		<a
			class="button ChannelCard-open"
			href={getChannelLiveUrl(channel)}
			target="_blank"
			rel="noopener noreferrer"
		>
			Auf {platformLabel} öffnen (mit Chat)
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{#if channel.platform === 'youtube'}
			<span class="ChannelCard-links-hint muted">
				Chat, Like und Abo gibt es direkt auf YouTube.
			</span>
		{/if}
	</div>
	{#if chat}
		<StreamChat {chat} title={channel.name} />
	{/if}
</article>

<style>
	.ChannelCard {
		min-width: 0;
		padding: 14px 16px 16px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-m);
		background: var(--surface);
	}

	.ChannelCard-on-air {
		box-shadow: inset 4px 0 0 #c4302b;
	}

	.ChannelCard-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.ChannelCard-name {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.ChannelCard-name :global(.FavoriteStar) {
		flex: none;
		margin-left: -6px;
	}

	.ChannelCard-badge {
		flex: none;
		margin-top: 2px;
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		color: #ffffff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.3px;
	}

	.ChannelCard-badge-youtube {
		background: #c4302b;
	}

	.ChannelCard-badge-twitch {
		background: #6441a5;
	}

	.ChannelCard-schedule {
		margin: 6px 0 0;
		font-size: 0.92em;
	}

	.ChannelCard-live {
		display: inline-block;
		margin-right: 6px;
		padding: 1px 8px;
		border-radius: var(--radius-pill);
		background: #c4302b;
		color: #ffffff;
		font-size: 0.82em;
		font-weight: 700;
	}

	.ChannelCard-notes {
		margin: 6px 0 0;
		color: var(--ink-soft);
		font-size: 0.92em;
	}

	.ChannelCard-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		margin-top: 8px;
	}

	.ChannelCard-links-hint {
		font-size: 0.85em;
	}

	:global([data-design='oldschool']) .ChannelCard {
		padding: 6px 8px 8px;
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
		border-radius: 0;
	}

	:global([data-design='oldschool']) .ChannelCard-on-air {
		box-shadow: inset 4px 0 0 var(--live);
	}

	:global([data-design='oldschool']) .ChannelCard-name {
		font-size: 13px;
		font-weight: 700;
	}

	:global([data-design='oldschool']) .ChannelCard-badge,
	:global([data-design='oldschool']) .ChannelCard-live {
		border-radius: 0;
	}
</style>
