import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const sounds = vi.hoisted(() => ({ playCountdown: vi.fn() }));
vi.mock('#lib/sound/gameSounds.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/sound/gameSounds.ts')>()),
	playCountdown: sounds.playCountdown
}));

const { default: GameClock } = await import('./GameClock.svelte');

const RULES = { size: 19, komi: 6.5, byoYomiTime: 30, byoYomiPeriods: 5 };

describe('GameClock', () => {
	it('beeps for the last seconds on our own running clock', async () => {
		sounds.playCountdown.mockClear();
		await render(GameClock, {
			nodeId: 1,
			active: true,
			clock: { running: true, time: 2.5, periodsLeft: 1 },
			timeLeft: 2.5,
			gameRules: RULES,
			announce: true
		});
		await vi.waitFor(() => expect(sounds.playCountdown).toHaveBeenCalledWith(3));
		await vi.waitFor(() => expect(sounds.playCountdown).toHaveBeenCalledWith(2), {
			timeout: 2000
		});
	});

	it('turns red in byo-yomi, not in the main time', async () => {
		const main = await render(GameClock, {
			nodeId: 1,
			active: true,
			clock: { running: true, time: 600, periodsLeft: 0 },
			timeLeft: 600,
			gameRules: RULES
		});
		const timer = main.container.querySelector('.GameClock')!;
		expect(timer.classList.contains('GameClock-overtime')).toBe(false);
		await main.unmount();
		const byoYomi = await render(GameClock, {
			nodeId: 1,
			active: true,
			clock: { running: true, time: 25, periodsLeft: 3 },
			timeLeft: 25,
			gameRules: RULES
		});
		const clock = byoYomi.container.querySelector('.GameClock')!;
		expect(clock.classList.contains('GameClock-overtime')).toBe(true);
		expect(getComputedStyle(clock).color).toBe('rgb(179, 38, 30)');
		expect(clock.textContent).toContain('(3)');
	});

	it('counts into byo-yomi when the main time runs out', async () => {
		const view = await render(GameClock, {
			nodeId: 1,
			active: true,
			// KGS: periodsLeft 0 while the main time lasts.
			clock: { running: true, time: 0.4, periodsLeft: 0 },
			timeLeft: 0.4,
			gameRules: RULES
		});
		const clock = view.container.querySelector('.GameClock')!;
		await vi.waitFor(() => expect(clock.classList.contains('GameClock-overtime')).toBe(true), {
			timeout: 2000
		});
	});

	it('stays silent on the opponent’s clock', async () => {
		sounds.playCountdown.mockClear();
		await render(GameClock, {
			nodeId: 1,
			active: true,
			clock: { running: true, time: 2.5, periodsLeft: 1 },
			timeLeft: 2.5,
			gameRules: RULES
		});
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(sounds.playCountdown).not.toHaveBeenCalled();
	});
});
