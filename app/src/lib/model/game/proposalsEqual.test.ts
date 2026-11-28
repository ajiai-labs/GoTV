// KGS's echo of a proposal leaves out false booleans and the time fields its
// time system does not use (review 28.11.2026: a handicap game we proposed
// was never accepted by itself - our nigiri: false against a missing nigiri).
import { describe, expect, it } from 'vitest';
import { proposalsEqual } from './challenge';
import { annaProposal } from '../__fixtures__/challenge';
import type { GameProposal } from '../types';

const players = [
	{ role: 'white', name: 'anna' },
	{ role: 'black', name: 'andy1975' }
] as GameProposal['players'];

describe('proposalsEqual', () => {
	const sent: GameProposal = { ...annaProposal, private: false, players };

	it('takes a missing false boolean as false', () => {
		const echo = { ...sent, players } as GameProposal;
		delete (echo as Partial<GameProposal>).nigiri;
		delete (echo as Partial<GameProposal>).private;
		expect(proposalsEqual(sent, echo)).toBe(true);
	});

	it('ignores time fields the time system does not use', () => {
		const canadian: GameProposal = {
			...sent,
			rules: { ...sent.rules, timeSystem: 'canadian', byoYomiStones: 25, byoYomiTime: 300 }
		};
		const echo: GameProposal = {
			...canadian,
			rules: { ...canadian.rules, byoYomiPeriods: undefined }
		};
		expect(proposalsEqual(canadian, echo)).toBe(true);
		const none: GameProposal = { ...sent, rules: { ...sent.rules, timeSystem: 'none' } };
		expect(
			proposalsEqual(none, {
				...none,
				rules: { size: 19, komi: 6.5, rules: 'japanese', timeSystem: 'none' }
			})
		).toBe(true);
	});

	it('still sees a real change', () => {
		expect(proposalsEqual(sent, { ...sent, rules: { ...sent.rules, komi: 0.5 } })).toBe(false);
		expect(proposalsEqual(sent, { ...sent, nigiri: true })).toBe(false);
		expect(proposalsEqual(sent, { ...sent, rules: { ...sent.rules, byoYomiPeriods: 3 } })).toBe(
			false
		);
	});
});
