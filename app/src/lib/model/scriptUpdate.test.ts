import { describe, expect, it } from 'vitest';
import { describeChanges, versionName } from './scriptUpdate.ts';

describe('versionName and describeChanges', () => {
	it('names a version after the release it builds on', () => {
		const v = (describe: string | null) => ({
			describe,
			commit: 'abc1234',
			date: '2026-11-28T12:00:00+01:00'
		});
		expect(versionName(v('desktop-v0.4.1-40-gabc1234'))).toEqual({
			name: '0.4.1+40',
			base: '0.4.1',
			count: 40
		});
		expect(versionName(v('desktop-v0.4.1-0-gabc1234')).name).toBe('0.4.1');
		expect(versionName(v(null)).name).toBe('abc1234');
	});

	it('keeps new features and fixes, drops docs, tests and chores', () => {
		expect(
			describeChanges([
				'feat(app): four variants of every sound',
				'docs: README',
				'fix(app): board overview closes itself',
				'test: more',
				'Merge branch x'
			])
		).toEqual([
			{ kind: 'feat', text: 'Four variants of every sound' },
			{ kind: 'fix', text: 'Board overview closes itself' }
		]);
	});
});
