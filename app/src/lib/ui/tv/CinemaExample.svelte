<script lang="ts">
	// A permanent example, not a calendar or live event: the EGF Twitch
	// channel (its current programme or offline picture) next to the final of
	// the European Championship 2026 as a recording. Live only offers it when
	// no real broadcast is running. Neither the player nor the SGF loads
	// before the click.
	import { config } from '#lib/config.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import BroadcastCard from './BroadcastCard.svelte';

	const SGF_URL = config.basePath + '/tv/em-finale-2026.sgf';
	const FINAL: TvEvent = {
		id: 'cinema-example-ec2026-final',
		name: 'EM-Finale 2026 · Andrii Kravets gegen Ali Jabarin',
		date_start: '2026-08-02',
		platform: 'twitch',
		stream_url: 'https://www.twitch.tv/europeangofederation',
		sgf_url: SGF_URL,
		notes:
			'Der EGF-Kanal zeigt sein aktuelles Programm oder das Offlinebild. ' +
			'Das Nachspielbrett zeigt die historische Finalpartie und läuft unabhängig vom Video.'
	};
</script>

<section class="CinemaExample" aria-labelledby="cinema-example-title">
	<header class="CinemaExample-head">
		<h2 id="cinema-example-title">GoTV ausprobieren</h2>
		<p class="muted">Beispiel · Aufzeichnung, keine Live-Partie</p>
	</header>
	<BroadcastCard
		broadcast={{ event: FINAL, games: [] }}
		onJoinGame={() => {}}
		recordingUrl={SGF_URL}
	/>
	<p class="CinemaExample-source muted">
		Partie aus dem
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the EGF archive, outside GoTV -->
		<a href="https://eurogofed.org/archives/egc/en/2026/" target="_blank" rel="noopener noreferrer">
			offiziellen EGF-Archiv
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
