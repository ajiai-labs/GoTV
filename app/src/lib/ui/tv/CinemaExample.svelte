<script lang="ts">
	// A permanent example, not a calendar or live event: the EGF Twitch
	// channel (its current programme or offline picture) next to the final of
	// the European Championship 2026 as a recording. Live only offers it when
	// no real broadcast is running. Neither the player nor the SGF loads
	// before the click.
	import { config } from '#lib/config.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import BroadcastCard from './BroadcastCard.svelte';

	const SGF_URL = config.basePath + '/tv/em-finale-2026.sgf';
	let final: TvEvent = $derived({
		id: 'cinema-example-ec2026-final',
		name: t('tv.example.eventName'),
		date_start: '2026-08-02',
		platform: 'twitch',
		stream_url: 'https://www.twitch.tv/europeangofederation',
		sgf_url: SGF_URL,
		notes: t('tv.example.eventNotes')
	});
</script>

<section class="CinemaExample" aria-labelledby="cinema-example-title">
	<header class="CinemaExample-head">
		<h2 id="cinema-example-title">{t('tv.example.title')}</h2>
		<p class="muted">{t('tv.example.subtitle')}</p>
	</header>
	<BroadcastCard
		broadcast={{ event: final, games: [] }}
		onJoinGame={() => {}}
		recordingUrl={SGF_URL}
	/>
	<p class="CinemaExample-source muted">
		{t('tv.example.sourceBefore')}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the EGF archive, outside GoTV -->
		<a href="https://eurogofed.org/archives/egc/en/2026/" target="_blank" rel="noopener noreferrer">
			{t('tv.example.sourceLink')}
		</a>.
	</p>
</section>

<style>
	.CinemaExample {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}

	.CinemaExample-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 14px;
	}

	h2 {
		margin: 0;
		font-size: var(--title-size);
		font-weight: var(--title-weight);
	}

	p {
		margin: 0;
		font-size: 0.9em;
	}
</style>
