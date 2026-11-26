import { describe, expect, it } from 'vitest';
import {
	SHELL_VARIANTS,
	STONE_RADIUS,
	WHITE_RADIUS,
	shellLines,
	shellVariant
} from './stoneLook.ts';

describe('stone look', () => {
	it('draws white 2 % smaller than black, like a real Go set', () => {
		expect(WHITE_RADIUS).toBeCloseTo(STONE_RADIUS * 0.98);
	});

	it('gives every shell variant the same fine lines on every render', () => {
		for (let v = 0; v < SHELL_VARIANTS; v++) {
			const lines = shellLines(v);
			expect(lines.length).toBeGreaterThan(8);
			expect(lines.length).toBeLessThan(30);
			expect(shellLines(v)).toEqual(lines);
			for (const line of lines) {
				expect(line.d).toMatch(/^M -?[\d.]+ -?[\d.]+ A /);
				expect(line.width).toBeLessThanOrEqual(0.02);
				expect(line.opacity).toBeLessThanOrEqual(0.26);
			}
		}
		expect(shellLines(0)).not.toEqual(shellLines(1));
	});

	it('never gives neighbouring stones the same variant', () => {
		for (let y = 1; y < 18; y++) {
			for (let x = 1; x < 18; x++) {
				const own = shellVariant(x, y);
				for (const [dx, dy] of [
					[1, 0],
					[0, 1],
					[1, 1],
					[1, -1]
				]) {
					expect(shellVariant(x + dx, y + dy)).not.toBe(own);
				}
			}
		}
	});
});
