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
