<script lang="ts" module>
	import type { GameRules } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	// A duration as people say it: "30 Sek.", "10 Min.", "1:30 Min.", "1 Std."
	export function formatDurationDe(seconds: number): string {
		const total = Math.max(0, Math.round(seconds));
		if (total < 60) return t('game.time.seconds', { n: total });
		if (total % 3600 === 0) return t('game.time.hours', { n: total / 3600 });
		if (total % 60 === 0) return t('game.time.minutes', { n: total / 60 });
		const secs = total % 60;
		return t('game.time.minutesSeconds', {
			m: Math.floor(total / 60),
			s: (secs < 10 ? '0' : '') + secs
		});
	}

	// The time system in words (wish of the user, 28.11.2026, after the
	// mockups): "30 Min. + 5×30 Sek." instead of "30:00 + 5×0:30".
	export function formatTimeSystemDe(rules: GameRules): string {
		const main = rules.mainTime || 0;
		const mainText = main > 0 ? formatDurationDe(main) : '';
		const join = (extra: string) => (mainText ? `${mainText} + ${extra}` : extra);
		switch (rules.timeSystem) {
			case 'none':
				return t('game.time.none');
			case 'absolute':
				return `${formatDurationDe(main)} ${t('game.time.absolute')}`;
			case 'byo_yomi':
				return join(`${rules.byoYomiPeriods || 0}×${formatDurationDe(rules.byoYomiTime || 0)}`);
			case 'canadian':
				return join(
					t('game.time.canadian', {
						stones: rules.byoYomiStones || 0,
						time: formatDurationDe(rules.byoYomiTime || 0)
					})
				);
			default:
				return '';
		}
	}
</script>

<script lang="ts">
	// The time system of a game ("10:00 + 5×0:30") with a sign for its pace:
	// two bolts for very fast, one for fast, an hourglass for slow games.
	import { getGameTimeSpeed } from '#lib/model/game/display.ts';

	let { rules }: { rules: GameRules } = $props();

	let speed = $derived(getGameTimeSpeed(rules));
	let icon = $derived(
		speed === 'very fast' ? '⚡⚡' : speed === 'fast' ? '⚡' : speed === 'slow' ? '⏳' : ''
	);
	let speedLabel = $derived(
		t(
			speed === 'very fast'
				? 'game.time.veryFast'
				: speed === 'fast'
					? 'game.time.fast'
					: 'game.time.slow'
		)
	);
</script>

<span class="GameTimeSystem">
	{#if icon}
		<span class="GameTimeSystem-icon" role="img" aria-label={speedLabel} title={speedLabel}>
			{icon}
		</span>
	{/if}
	{formatTimeSystemDe(rules)}
</span>

<style>
	.GameTimeSystem {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.GameTimeSystem-icon {
		font-size: 0.85em;
		letter-spacing: -2px;
	}
</style>
