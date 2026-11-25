<script lang="ts">
	// "Server-Statistik" (CGoban, Datei menu): players and games on KGS now
	// and at most since the last restart. Loaded on request.
	import { app } from '#lib/app.svelte.ts';
	import { locale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import type { ServerStats } from '#lib/model/community.ts';

	const uid = $props.id();
	let stats = $derived(app.state.serverStats);

	const ROWS: Array<[keyof ServerStats, MessageKey]> = [
		['logins', 'community.stats.logins'],
		['loginsMax', 'community.stats.loginsMax'],
		['games', 'community.stats.games'],
		['gamesMax', 'community.stats.gamesMax'],
		['rooms', 'community.stats.rooms'],
		['accounts', 'community.stats.accounts']
	];

	function number(value: unknown): string {
		return typeof value === 'number' ? value.toLocaleString(locale()) : '–';
	}
</script>

<section class="ServerStats panel" aria-labelledby="{uid}-title">
	<div class="ServerStats-head">
		<h2 id="{uid}-title" class="panel-title">{t('community.stats.title')}</h2>
		<button type="button" class="button" onclick={() => app.actions.onRequestServerStats()}>
			{t('community.stats.load')}
		</button>
	</div>
	{#if stats}
		<dl>
			{#each ROWS as [key, label] (key)}
				{#if stats[key] != null}
					<dt>{t(label)}</dt>
					<dd>{number(stats[key])}</dd>
				{/if}
			{/each}
			{#if stats.serverStartTime}
				<dt>{t('community.stats.started')}</dt>
				<dd>{formatLocaleDateTime(stats.serverStartTime)}</dd>
			{/if}
			{#if stats.version}
				<dt>{t('community.stats.version')}</dt>
				<dd>{stats.version}</dd>
			{/if}
		</dl>
	{/if}
</section>

<style>
	.ServerStats {
		padding-bottom: 12px;
	}

	.ServerStats-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-right: 16px;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 16px;
		margin: 4px 16px 0;
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
</style>
