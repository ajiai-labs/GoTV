// Test data for the Spielen page: users, rooms, challenges and proposals
// in the shape the KGS messages leave them in the app state.
import type {
	GameChannel,
	GameProposal,
	GameSummary,
	Index,
	Room,
	User
} from '#lib/model/types.ts';

export const me: User = { name: 'gotvfan', rank: '3k', rankVal: -3, flags: { connected: true } };
export const anna: User = { name: 'anna', rank: '2d', rankVal: 2, flags: { connected: true } };
export const bernd: User = { name: 'bernd', rank: '5k', rankVal: -5, flags: { connected: true } };

export const usersByName: Index<User> = { gotvfan: me, anna, bernd };

export const ENGLISH_ROOM = 11;
export const GERMAN_ROOM = 12;

function room(id: number, name: string, users: Array<string>): Room {
	return { id, name, description: null, owners: null, users, category: 'MAIN' };
}

export const roomsById: Index<Room> = {
	[ENGLISH_ROOM]: room(ENGLISH_ROOM, 'English Game Room', ['anna', 'bernd', 'gotvfan']),
	[GERMAN_ROOM]: room(GERMAN_ROOM, 'Deutscher Spielraum', ['gotvfan'])
};

// Anna's challenge: 19×19, byo-yomi 20:00 + 5×0:30, she is white.
export const annaProposal: GameProposal = {
	gameType: 'free',
	nigiri: false,
	rules: {
		size: 19,
		komi: 6.5,
		handicap: 0,
		rules: 'japanese',
		timeSystem: 'byo_yomi',
		mainTime: 20 * 60,
		byoYomiTime: 30,
		byoYomiPeriods: 5
	},
	players: [{ role: 'white', user: { name: 'anna', rank: '2d' } }, { role: 'black' }]
};

export const ANNA_CHALLENGE = 501;

export const annaChallenge: GameChannel = {
	id: ANNA_CHALLENGE,
	type: 'challenge',
	time: 1,
	moveNum: 0,
	roomId: ENGLISH_ROOM,
	players: { challengeCreator: anna },
	name: 'Gern mit Besprechung',
	initialProposal: annaProposal
};

// Our own challenge, two answers received (anna, bernd).
export const MY_CHALLENGE = 502;

export const myProposal: GameProposal = {
	gameType: 'ranked',
	nigiri: true,
	rules: {
		size: 19,
		komi: 6.5,
		rules: 'japanese',
		timeSystem: 'byo_yomi',
		mainTime: 20 * 60,
		byoYomiTime: 30,
		byoYomiPeriods: 5
	},
	players: [{ role: 'white', user: { name: 'gotvfan', rank: '3k' } }, { role: 'black' }]
};

export const fromAnna: GameProposal = {
	...myProposal,
	nigiri: false,
	rules: { ...myProposal.rules, handicap: 5, komi: 0.5 },
	players: [
		{ role: 'black', name: 'gotvfan' },
		{ role: 'white', name: 'anna' }
	]
};

export const fromBernd: GameProposal = {
	...myProposal,
	nigiri: false,
	rules: { ...myProposal.rules, handicap: 2, komi: 0.5 },
	players: [
		{ role: 'white', name: 'gotvfan' },
		{ role: 'black', name: 'bernd' }
	]
};

export const myChallenge: GameChannel = {
	id: MY_CHALLENGE,
	type: 'challenge',
	time: 2,
	moveNum: 0,
	roomId: ENGLISH_ROOM,
	players: { challengeCreator: me },
	initialProposal: myProposal,
	receivedProposals: [fromAnna, fromBernd],
	actions: [{ action: 'CHALLENGE_SETUP', user: { name: 'gotvfan' } }]
};

export const summaries: Array<GameSummary> = [
	{
		timestamp: '2026-11-20T18:00:00.000Z',
		type: 'ranked',
		rules: {
			size: 19,
			komi: 6.5,
			timeSystem: 'byo_yomi',
			mainTime: 1200,
			byoYomiTime: 30,
			byoYomiPeriods: 5
		},
		players: { white: me, black: bernd },
		score: 'W+RESIGN'
	},
	{
		timestamp: '2026-11-22T19:30:00.000Z',
		type: 'free',
		rules: { size: 13, komi: 6.5, timeSystem: 'absolute', mainTime: 600 },
		players: { white: anna, black: me },
		inPlay: true
	}
];
