import {
	collectBackup,
	describeBackup,
	getBackupFileName,
	parseBackup,
	restoreBackup
} from './Backup';
import { language } from '#lib/i18n/index.svelte.ts';
const NOW = new Date(2026, 10, 23, 19, 30);

function storageFrom(entries) {
	const map = new Map(Object.entries(entries));
	return {
		get length() {
			return map.size;
		},

		key: (index) => Array.from(map.keys())[index] || null,
		getItem: (key) => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => map.set(key, value),
		map
	};
}

const DESKTOP = {
	'gotv.favorites': JSON.stringify({
		channels: ['jupptube'],
		events: ['sg-1']
	}),
	'gotv.replays': JSON.stringify({
		'url:a': {
			move: 80,
			title: 'A',
			updatedAt: 200,
			bookmarks: [
				{
					move: 57,
					note: 'Kampf'
				}
			],
			variations: [
				{
					path: [0],
					x: 1,
					y: 1
				},
				{
					path: [0, 1],
					x: 2,
					y: 2
				}
			]
		}
	}),
	'gotv.katago': '1',
	'gotv.notified': JSON.stringify(['channel:x:1']),
	'other.app': 'not ours'
};
describe('collectBackup', () => {
	it('takes every GoTV key except the reminder log', () => {
		const backup = collectBackup(storageFrom(DESKTOP), NOW);
		expect(backup.format).toBe('gotv-backup');
		expect(backup.version).toBe(1);
		expect(Object.keys(backup.data).sort()).toEqual([
			'gotv.favorites',
			'gotv.katago',
			'gotv.replays'
		]);
		expect(getBackupFileName(NOW)).toBe('gotv-sicherung-2026-11-23.json');
	});
	it('carries the interface language and names the file in English', () => {
		const backup = collectBackup(storageFrom({ ...DESKTOP, 'gotv.language': 'en' }), NOW);
		expect(backup.data['gotv.language']).toBe('en');
		const target = storageFrom({ 'gotv.language': 'de' });
		restoreBackup(target, backup);
		expect(target.getItem('gotv.language')).toBe('en'); // a plain setting: the file wins
		language.current = 'en';
		expect(getBackupFileName(NOW)).toBe('gotv-backup-2026-11-23.json');
		expect(parseBackup('not json').error).toBe('The file is not a GoTV backup (not JSON).');
	});
	it('describes what the file holds', () => {
		const backup = collectBackup(storageFrom(DESKTOP), NOW);
		expect(describeBackup(backup)).toEqual({
			favoriteChannels: 1,
			favoriteEvents: 1,
			games: 1,
			bookmarks: 1,
			variationMoves: 2,
			settings: 1
		});
	});
});
describe('parseBackup', () => {
	it('reads its own files back', () => {
		const backup = collectBackup(storageFrom(DESKTOP), NOW);
		expect(parseBackup(JSON.stringify(backup))).toEqual({
			ok: true,
			backup
		});
	});
	it('refuses foreign files with a readable message', () => {
		expect(parseBackup('not json').error).toContain('keine GoTV-Sicherung');
		expect(parseBackup('{"format":"x"}').error).toContain('keine GoTV-Sicherung');
		expect(parseBackup('{"format":"gotv-backup","version":99,"data":{}}').error).toContain(
			'neueren GoTV-Version'
		);
	});
	it('leaves out foreign or broken entries', () => {
		const parsed = parseBackup(
			JSON.stringify({
				format: 'gotv-backup',
				version: 1,
				data: {
					'gotv.katago': '1',
					'evil.key': 'x',
					'gotv.cinemaSplit': 60,
					'gotv.notified': '[]'
				}
			})
		);
		expect(parsed.backup.data).toEqual({
			'gotv.katago': '1'
		});
	});
});
describe('restoreBackup', () => {
	it('merges collections and never deletes what is already here', () => {
		const tablet = storageFrom({
			'gotv.favorites': JSON.stringify({
				channels: ['egf'],
				events: []
			}),
			'gotv.replays': JSON.stringify({
				'url:a': {
					move: 10,
					title: 'A',
					updatedAt: 100,
					bookmarks: []
				},
				'url:b': {
					move: 5,
					title: 'B',
					updatedAt: 300,
					bookmarks: []
				}
			}),
			'gotv.ogsLinks': JSON.stringify({
				e1: 11
			}),
			'gotv.katago': '0'
		});
		const backup = collectBackup(storageFrom(DESKTOP), NOW);
		backup.data['gotv.ogsLinks'] = JSON.stringify({
			e2: 22
		});
		const changed = restoreBackup(tablet, backup);
		expect(changed).toBe(4);
		expect(JSON.parse(tablet.getItem('gotv.favorites'))).toEqual({
			channels: ['egf', 'jupptube'],
			events: ['sg-1']
		});
		const replays = JSON.parse(tablet.getItem('gotv.replays'));
		// The desktop's newer state of game A wins, game B stays.
		expect(replays['url:a'].move).toBe(80);
		expect(replays['url:a'].variations).toHaveLength(2);
		expect(replays['url:b'].move).toBe(5);
		expect(JSON.parse(tablet.getItem('gotv.ogsLinks'))).toEqual({
			e1: 11,
			e2: 22
		});
		expect(tablet.getItem('gotv.katago')).toBe('1');
	});
	it('keeps the newer game on this device and is repeatable', () => {
		const tablet = storageFrom({
			'gotv.replays': JSON.stringify({
				'url:a': {
					move: 120,
					title: 'A',
					updatedAt: 999,
					bookmarks: []
				}
			})
		});
		const backup = collectBackup(storageFrom(DESKTOP), NOW);
		restoreBackup(tablet, backup);
		expect(JSON.parse(tablet.getItem('gotv.replays'))['url:a'].move).toBe(120);
		// A second restore of the same file changes nothing more.
		expect(restoreBackup(tablet, backup)).toBe(0);
	});
	it("keeps the local value when the file's collection is broken", () => {
		const tablet = storageFrom({
			'gotv.favorites': '{"channels":["egf"]}'
		});
		const changed = restoreBackup(tablet, {
			format: 'gotv-backup',
			version: 1,
			createdAt: '',
			data: {
				'gotv.favorites': '{broken'
			}
		});
		expect(changed).toBe(0);
		expect(tablet.getItem('gotv.favorites')).toBe('{"channels":["egf"]}');
	});
	it('joins favourite KGS rooms as a union', () => {
		const tablet = storageFrom({
			'gotv.favoriteRooms': JSON.stringify([{ id: 3, name: 'Deutscher Raum' }])
		});
		restoreBackup(tablet, {
			format: 'gotv-backup',
			version: 1,
			createdAt: '',
			data: {
				'gotv.favoriteRooms': JSON.stringify([
					{ id: 9, name: 'Go Club' },
					{ id: 3, name: 'Deutscher Raum' }
				])
			}
		});
		expect(JSON.parse(tablet.getItem('gotv.favoriteRooms'))).toEqual([
			{ id: 3, name: 'Deutscher Raum' },
			{ id: 9, name: 'Go Club' }
		]);
	});
	it('leaves the closed home screen hint on this device', () => {
		const backup = collectBackup(
			storageFrom({ 'gotv.homeHintDismissed': '1', 'gotv.katago': '1' }),
			NOW
		);
		expect(Object.keys(backup.data)).toEqual(['gotv.katago']);
	});
});
