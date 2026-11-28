import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinWindowFamily, type WindowFamily } from './windowFamily.ts';

const FAST = { heartbeatMs: 50, staleMs: 400, waitMs: 60, answerMs: 60 };
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('windowFamily', () => {
	const open: Array<WindowFamily> = [];
	const join = (...args: Parameters<typeof joinWindowFamily>) => {
		const family = joinWindowFamily(...args);
		open.push(family);
		return family;
	};
	afterEach(() => {
		for (const family of open.splice(0)) family.leave();
	});

	it('lets the main window know which other windows are open', async () => {
		const main = join('main', vi.fn(), vi.fn(), FAST);
		const child = join('child', vi.fn(), vi.fn(), FAST);
		await wait(120);
		expect(main.count('child')).toBe(1);
		child.leave();
		await wait(50);
		expect(main.count('child')).toBe(0);
	});

	it('tells the other windows when the main window is gone', async () => {
		const main = join('main', vi.fn(), vi.fn(), FAST);
		const gone = vi.fn();
		join('child', gone, vi.fn(), FAST);
		await wait(120);
		main.leave();
		await vi.waitFor(() => expect(gone).toHaveBeenCalledOnce(), { timeout: 1000 });
	});

	it('closes nothing when the main window comes back (reload) or another one is open', async () => {
		const gone = vi.fn();
		const back = vi.fn();
		join('child', gone, back, FAST);
		const first = join('main', vi.fn(), vi.fn(), FAST);
		await wait(120);
		first.leave();
		join('main', vi.fn(), vi.fn(), FAST); // the reloaded main window
		await wait(300);
		expect(gone).not.toHaveBeenCalled();
	});
});
