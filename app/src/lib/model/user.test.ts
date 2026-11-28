import { describe, expect, it } from 'vitest';
import { buildDetailsChange } from './user';
import type { UserDetails } from './types';

describe('buildDetailsChange', () => {
	const me = { name: 'andy1975', rank: '1d' };
	const details = {
		channelId: 70,
		personalName: 'Andreas',
		personalInfo: 'x'.repeat(2000),
		regStartDate: '',
		lastOn: '',
		locale: 'de_DE'
	} as unknown as UserDetails;

	it('sends every field, booleans as true/false, texts within the limits', () => {
		// KGS left out the false booleans and the e-mail (private address).
		expect(buildDetailsChange(me, details)).toEqual({
			type: 'DETAILS_CHANGE',
			channelId: 70,
			personalName: 'Andreas',
			personalEmail: '',
			personalInfo: 'x'.repeat(1500),
			emailWanted: false,
			privateEmail: false,
			rankWanted: false,
			forcedNoRank: false,
			authLevel: 'normal'
		});
	});

	it('keeps what is set, and an admin level unchanged', () => {
		const message = buildDetailsChange(
			{ ...me, authLevel: 'teacher' },
			{ ...details, email: 'a@example.org', privateEmail: true, rankWanted: true }
		);
		expect(message).toMatchObject({
			personalEmail: 'a@example.org',
			privateEmail: true,
			rankWanted: true,
			authLevel: 'teacher'
		});
	});
});
