import { userHasRank, userUnranked } from '../user';
import type { User, GameProposal, GameRules, Index } from '../types';
export const DEFAULT_KOMI = 6.5;
type MatchupInfo = {
	white: string;
	black: string;
	handicap: number;
	komi: number;
	nigiri: boolean;
	unranked: boolean;
};
export function getMatchupInfo(user1: User, user2: User, initialKomi?: number): MatchupInfo {
	let rank1 = user1.rankVal;
	let rank2 = user2.rankVal;
	const unranked = userUnranked(user1) || userUnranked(user2);

	if (
		!userHasRank(user1) ||
		!userHasRank(user2) ||
		user1.rankVal === user2.rankVal ||
		typeof rank1 !== 'number' ||
		typeof rank2 !== 'number'
	) {
		return {
			white: user1.name,
			black: user2.name,
			handicap: 0,
			komi: initialKomi || DEFAULT_KOMI,
			nigiri: true,
			unranked
		};
	}

	rank1 = rank1 < 0 ? rank1 + 1 : rank1;
	rank2 = rank2 < 0 ? rank2 + 1 : rank2;
	let white;
	let black;
	let handicap;
	const komi = 0.5;
	const nigiri = false;

	if (rank1 > rank2) {
		white = user1.name;
		black = user2.name;
		handicap = Math.max(0, Math.min(rank1 - rank2, 9));
	} else {
		white = user2.name;
		black = user1.name;
		handicap = Math.max(0, Math.min(rank2 - rank1, 9));
	}

	if (handicap === 1) {
		handicap = 0;
	}

	return {
		white,
		black,
		handicap,
		komi,
		nigiri,
		unranked
	};
}
// Whether KGS's echo of a proposal is the proposal we sent. KGS leaves out
// false booleans and the time fields its time system does not use: our
// nigiri: false and its missing nigiri are the same (review 28.11.2026 -
// before, a handicap game was never accepted by itself).
function timeFields(rules: GameProposal['rules']): Array<unknown> {
	switch (rules.timeSystem) {
		case 'none':
			return [];
		case 'absolute':
			return [rules.mainTime ?? 0];
		case 'canadian':
			return [rules.mainTime ?? 0, rules.byoYomiStones ?? 0, rules.byoYomiTime ?? 0];
		default:
			return [rules.mainTime ?? 0, rules.byoYomiPeriods ?? 0, rules.byoYomiTime ?? 0];
	}
}

export function proposalsEqual(p1: GameProposal, p2: GameProposal) {
	if (
		p1.gameType !== p2.gameType ||
		!!p1.nigiri !== !!p2.nigiri ||
		!!p1.private !== !!p2.private ||
		p1.rules.size !== p2.rules.size ||
		(p1.rules.komi ?? 0) !== (p2.rules.komi ?? 0) ||
		(p1.rules.handicap || 0) !== (p2.rules.handicap || 0) ||
		p1.rules.rules !== p2.rules.rules ||
		p1.rules.timeSystem !== p2.rules.timeSystem ||
		timeFields(p1.rules).join() !== timeFields(p2.rules).join() ||
		p1.players.length !== p2.players.length
	) {
		return false;
	}

	if (p1.nigiri) {
		return true;
	}

	for (let i = 0; i < p1.players.length; i++) {
		if (p1.players[i].role !== p2.players[i].role) {
			return false;
		}

		const user1 = p1.players[i].user;
		const user2 = p2.players[i].user;
		const name1 = user1 ? user1.name : p1.players[i].name;
		const name2 = user2 ? user2.name : p2.players[i].name;

		if (name1 !== name2) {
			return false;
		}
	}

	return true;
}
export function getEvenProposal(
	initialProposal: GameProposal,
	challengerName: string,
	usersByName: Index<User>
): GameProposal {
	const proposal = { ...initialProposal };
	const players = [];
	let otherUser;
	let challenging = false;

	// Put players into expected format (name only, not full user)
	// and while we're at it, figure out who the other user is and if
	// we're challening or receiving challenges
	for (const player of proposal.players) {
		const newPlayer = { ...player };

		if (newPlayer.user) {
			newPlayer.name = newPlayer.user.name;
			delete newPlayer.user;
		} else if (!newPlayer.name) {
			newPlayer.name = challengerName;
			challenging = true;
		}

		if (newPlayer.name !== challengerName) {
			otherUser = usersByName[newPlayer.name];
		}

		players.push(newPlayer);
	}

	// If sending a challenge, auto-set handicap and komi as appropriate
	const challenger = usersByName[challengerName];

	if (challenging && otherUser && challenger) {
		const matchupInfo = getMatchupInfo(challenger, otherUser, proposal.rules.komi);
		const { handicap, komi, nigiri, white, black, unranked } = matchupInfo;
		proposal.rules = { ...proposal.rules, handicap, komi };
		proposal.nigiri = nigiri;

		if (unranked && proposal.gameType === 'ranked') {
			proposal.gameType = 'free';
		}

		for (const player of players) {
			if (!player.name) {
				continue;
			}

			if (player.name === white) {
				player.role = 'white';
			} else if (player.name === black) {
				player.role = 'black';
			}
		}
	}

	proposal.players = players;

	if (!proposal.status) {
		proposal.status = 'setup';
	}

	return proposal;
}
export function createInitialProposal(
	currentUser: User,
	lastProposal?: GameProposal | null | undefined
): GameProposal {
	const players: GameProposal['players'] = [
		{
			name: currentUser.name,
			role: 'white'
		},
		{
			role: 'black'
		}
	];
	const flags = currentUser.flags;
	const canPlayRanked =
		!userUnranked(currentUser) &&
		(!flags || (flags.canPlayRanked !== undefined ? flags.canPlayRanked : true));
	const gameType = lastProposal ? lastProposal.gameType : canPlayRanked ? 'ranked' : 'free';
	const rules: GameRules = lastProposal
		? lastProposal.rules
		: {
				komi: DEFAULT_KOMI,
				size: 19,
				rules: 'japanese',
				timeSystem: 'byo_yomi',
				mainTime: 60 * 20,
				byoYomiPeriods: 5,
				byoYomiTime: 30
			};
	const proposal: GameProposal = {
		gameType,
		players,
		rules,
		nigiri: true
	};
	return proposal;
}
export function getOtherPlayerName(proposal: GameProposal, ourName: string) {
	for (const player of proposal.players) {
		const name = player.user ? player.user.name : player.name;

		if (name && name !== ourName) {
			return name;
		}
	}

	return null;
}
