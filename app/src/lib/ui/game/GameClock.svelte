<script lang="ts" module>
	// "m:ss", "--" without a time, never below zero.
	export function formatClockTime(time: number | null | undefined): string {
		if (typeof time !== 'number') return '--';
		const seconds = Math.max(0, time);
		let mins = Math.floor(seconds / 60);
		let secs = Math.ceil(seconds - mins * 60);
		if (secs === 60) {
			mins += 1;
			secs = 0;
		}
		return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
	}
</script>

<script lang="ts">
	// A player's clock. Following the game (active), it counts down from the
	// server's time every 100 ms, through byo-yomi periods and Canadian
	// overtime; looking at an earlier move, it shows the time left then.
	// "SD" marks sudden death (last period), "(3)" the periods left, "/ 5"
	// the stones left in Canadian overtime. Once the main time is over
	// (byo-yomi or Canadian overtime) the digits turn red - you see that the
	// time is running out (user, 28.11.2026); under 3 seconds of sudden death
	// the whole clock turns red.
	import type { ClockState, GameRules } from '#lib/model/types.ts';
	import { COUNTDOWN_SECONDS, playCountdown } from '#lib/sound/gameSounds.ts';

	// Compensation for network and rendering lag, as in the old app.
	const TIME_SKEW = 300;
	const TICK = 100;
	const URGENT_SECONDS = 3;

	let {
		nodeId,
		active,
		clock,
		timeLeft,
		gameRules = null,
		announce = false
	}: {
		nodeId: number | null | undefined;
		active: boolean;
		clock: ClockState;
		timeLeft: number;
		gameRules?: GameRules | null;
		// Our own clock: a beep for each of the last seconds (gameSounds).
		announce?: boolean;
	} = $props();

	let startTime = $state(Date.now() - TIME_SKEW);
	let now = $state(Date.now());

	// A new move or a new time from the server restarts the countdown.
	$effect(() => {
		void nodeId;
		void clock.time;
		void clock.periodsLeft;
		void clock.stonesLeft;
		startTime = Date.now() - TIME_SKEW;
		now = Date.now();
	});

	let counting = $derived(
		active && !!clock.running && !clock.paused && typeof clock.time === 'number'
	);

	$effect(() => {
		if (!counting) return;
		const timer = setInterval(() => (now = Date.now()), TICK);
		return () => clearInterval(timer);
	});

	// What the countdown shows right now (TimeCountdown of the old app).
	let countdown = $derived.by(() => {
		const byoYomiTime = gameRules?.byoYomiTime;
		const byoYomiPeriods = gameRules?.byoYomiPeriods;
		const byoYomiStones = gameRules?.byoYomiStones;
		const elapsed = Math.max(0, now - startTime) / 1000;
		const mainTime = (clock.time || 0) - elapsed;
		let periods = clock.periodsLeft;
		let stones = clock.stonesLeft;
		let seconds: number;
		if (mainTime > 0) {
			seconds = mainTime;
		} else if (mainTime < 0 && byoYomiTime) {
			if (typeof periods === 'number' && byoYomiPeriods) {
				// Byo-yomi overtime
				const periodsLeft = periods ? periods - 1 : byoYomiPeriods;
				periods = Math.max(0, periodsLeft - Math.floor(-mainTime / byoYomiTime));
				seconds = periods ? byoYomiTime + mainTime + byoYomiTime * (periodsLeft - periods) : 0;
			} else if (stones === 0 && byoYomiStones) {
				// Canadian overtime
				stones = byoYomiStones;
				seconds = byoYomiTime + mainTime;
			} else {
				seconds = 0;
			}
		} else {
			seconds = 0;
		}
		return { seconds, periods, stones };
	});

	let shown = $derived(
		counting
			? countdown
			: { seconds: clock.time, periods: clock.periodsLeft, stones: clock.stonesLeft }
	);

	let qualifier = $derived.by(() => {
		const { seconds, periods, stones } = shown;
		if (periods !== undefined) {
			return { text: periods === 1 ? 'SD' : periods ? `(${periods})` : '', sd: periods === 1 };
		}
		if (stones) return { text: `/ ${stones}`, sd: true };
		if (seconds && stones === undefined) return { text: 'SD', sd: true };
		return { text: '', sd: false };
	});

	let urgent = $derived(
		qualifier.sd && typeof shown.seconds === 'number' && shown.seconds < URGENT_SECONDS
	);
	let running = $derived(active && !!clock.running && !clock.paused);
	// In overtime: periodsLeft / stonesLeft above 0 (KGS sends 0 or nothing
	// while the main time lasts - the countdown of the old app relies on it;
	// the countdown sets them when the main time runs out here).
	let overtime = $derived(active && ((shown.periods ?? 0) > 0 || (shown.stones ?? 0) > 0));

	// The whole seconds shown; a beep when it drops into the last ten.
	let wholeSeconds = $derived(
		typeof shown.seconds === 'number' ? Math.ceil(Math.max(0, shown.seconds)) : null
	);
	let beeped: number | null = null;
	$effect(() => {
		const seconds = wholeSeconds;
		if (!announce || !counting || seconds === null) {
			beeped = null;
			return;
		}
		if (seconds !== beeped && seconds >= 1 && seconds <= COUNTDOWN_SECONDS) playCountdown(seconds);
		beeped = seconds;
	});
</script>

<span
	class="GameClock"
	class:GameClock-active={active}
	class:GameClock-running={running}
	class:GameClock-paused={clock.paused}
	class:GameClock-overtime={overtime}
	class:GameClock-urgent={active && urgent}
	role="timer"
>
	{#if active}
		<span>{formatClockTime(shown.seconds)}</span>
		{#if qualifier.text}
			<span class="GameClock-qualifier">{' ' + qualifier.text}</span>
		{/if}
	{:else}
		{formatClockTime(timeLeft)}
	{/if}
</span>

<style>
	.GameClock {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
		/* Big enough to read at a glance (user, 28.11.2026). */
		padding: 3px 12px;
		border-radius: var(--radius-pill);
		background: var(--surface-sunk);
		color: var(--ink);
		font-size: 1.3rem;
		font-weight: 600;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.GameClock-qualifier {
		font-size: 0.85em;
		opacity: 0.85;
	}

	.GameClock-running {
		background: var(--accent);
		color: var(--accent-ink);
	}

	/* Overtime: red digits; the running clock keeps a red frame instead of
	   the accent colour, so it still shows whose clock runs. */
	.GameClock-overtime {
		color: var(--danger, #b3261e);
	}

	.GameClock-running.GameClock-overtime {
		background: var(--danger-bg, #fde7e5);
		color: var(--danger, #b3261e);
		box-shadow: inset 0 0 0 2px var(--danger, #b3261e);
	}

	.GameClock-paused {
		opacity: 0.6;
	}

	/* Last seconds of sudden death: wins over overtime and running. */
	.GameClock.GameClock.GameClock-urgent {
		background: #b3261e;
		box-shadow: none;
		color: #ffffff;
	}

	:global([data-design='oldschool']) .GameClock {
		border-radius: 0;
		background: #000;
		color: #9fe870;
		font-family: 'Courier New', monospace;
	}

	:global([data-design='oldschool']) .GameClock-running {
		color: #ffde59;
	}

	:global([data-design='oldschool']) .GameClock-overtime {
		background: #000;
		box-shadow: none;
		color: #ff5a4e;
	}

	:global([data-design='oldschool']) .GameClock-running.GameClock-overtime {
		background: #000;
		box-shadow: inset 0 0 0 2px #ff5a4e;
		color: #ff5a4e;
	}

	:global([data-design='oldschool']) .GameClock.GameClock.GameClock-urgent {
		background: #b3261e;
		color: #ffffff;
	}
</style>
