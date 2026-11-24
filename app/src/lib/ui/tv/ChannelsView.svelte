<script lang="ts">
	// The Kanäle: internet channels, kept apart from the tournament calendar.
	// Starred channels ("Favoriten") on top, then players' channels, then
	// federations and tournaments; a channel inside its fixed air time moves to
	// the top of its group.
	import type { Snippet } from 'svelte';
	import ChannelCard from './ChannelCard.svelte';
	import ChannelWeek from './ChannelWeek.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import { groupChannels, isChannelOnAir } from '#lib/model/tvChannels.ts';
	import type { TvChannel } from '#lib/model/tv.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		status,
		channels,
		now,
		onRetry,
		renderChannel,
		favoriteIds = [],
		onToggleFavorite
	}: {
		status: 'loading' | 'ready' | 'error';
		channels: Array<TvChannel>;
		now: number;
		onRetry?: () => unknown;
		// Lets the caller show a channel differently (e.g. as a broadcast with
		// its board while a calendar event uses it); otherwise a ChannelCard.
		renderChannel?: Snippet<[TvChannel, boolean]>;
		// Starred channel ids ("Mein GoTV"), in the order they were starred.
		favoriteIds?: Array<string>;
		onToggleFavorite?: (channelId: string) => unknown;
	} = $props();

	const GROUPS = [
		{ key: 'player', title: 'tv.channels.players' },
		{ key: 'organization', title: 'tv.channels.organizations' }
	] as const;

	let date = $derived(new Date(now));
	let groups = $derived(
		groupChannels(
			channels.filter((channel) => !favoriteIds.includes(channel.id)),
			date
		)
	);
	let starred = $derived(
		channels
			.filter((channel) => favoriteIds.includes(channel.id))
			.sort(
				(a, b) =>
					Number(isChannelOnAir(b, date)) - Number(isChannelOnAir(a, date)) ||
					favoriteIds.indexOf(a.id) - favoriteIds.indexOf(b.id)
			)
	);
	let sections = $derived([
		{ key: 'favorites', title: t('tv.channels.favorites'), channels: starred },
		...GROUPS.map(({ key, title }) => ({ key, title: t(title), channels: groups[key] }))
	]);
</script>

{#snippet channelEntry(channel: TvChannel)}
	{@const onAir = isChannelOnAir(channel, date)}
	{#if renderChannel}
		{@render renderChannel(channel, onAir)}
	{:else}
		<ChannelCard {channel} {onAir} favorite={favoriteIds.includes(channel.id)} {onToggleFavorite} />
	{/if}
{/snippet}

<div class="ChannelsView">
	{#if status === 'loading'}
		<Spinner label={t('tv.channels.loading')} />
	{:else if status === 'error'}
		<div class="ChannelsView-error panel" role="alert">
			<p>{t('tv.channels.error')}</p>
			{#if onRetry}
				<button type="button" class="button" onclick={() => onRetry()}>
					{t('tv.channels.retry')}
				</button>
			{/if}
		</div>
	{:else}
		<ChannelWeek {channels} {now} {favoriteIds} />
		{#each sections as section (section.key)}
			{#if section.channels.length}
				<section
					class="ChannelsView-group ChannelsView-group-{section.key}"
					aria-labelledby="ChannelsView-{section.key}"
				>
					<h2 class="ChannelsView-group-title" id="ChannelsView-{section.key}">
						{section.title}
					</h2>
					<div class="ChannelsView-cards">
						{#each section.channels as channel (channel.id)}
							{@render channelEntry(channel)}
						{/each}
					</div>
				</section>
			{/if}
		{/each}
		{#if !channels.length}
			<p class="ChannelsView-empty muted">{t('tv.channels.empty')}</p>
		{/if}
	{/if}
</div>

<style>
	.ChannelsView-error {
		padding: 16px;
	}

	.ChannelsView-error p {
		margin: 0 0 10px;
	}

	.ChannelsView-group {
		margin-bottom: calc(var(--gap) * 1.2);
	}

	.ChannelsView-group-title {
		margin: 0 0 10px;
		font-size: var(--title-size);
		font-weight: var(--title-weight);
	}

	.ChannelsView-group-favorites .ChannelsView-group-title {
		color: #a8791b;
	}

	.ChannelsView-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
		gap: 12px;
		align-items: start;
	}

	.ChannelsView-empty {
		margin: 0;
		padding: 16px 0;
	}

	:global([data-design='oldschool']) .ChannelsView-group {
		padding: 0 6px 6px;
		background: var(--surface);
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .ChannelsView-group-title {
		margin: 0 -6px 6px;
		padding: 3px 6px;
		background: var(--title-bar);
		color: var(--title-ink);
	}
</style>
