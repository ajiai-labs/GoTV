import { parseGameChannel, parseGameSummary } from './parse';
import {
	isGameProposalPlayer,
	isGamePlayer,
	isGamePlaying,
	computeGameNodeStates,
	getGameLine
} from './tree';
import { sortGames } from './display';
import type {
	AppState,
	AutomatchPrefs,
	KgsMessage,
	GameChannel,
	GameSummary,
	Index,
	ChannelMembership,
	UnfinishedGame
} from '../types';

function _handleGameMessage(prevState: AppState, msg: KgsMessage): AppState {
	const chanId = msg.channelId;

	if (msg.type === 'ROOM_JOIN' || msg.type === 'GAME_LIST' || msg.type === 'GLOBAL_GAMES_JOIN') {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };

		if (msg.games) {
			for (const game of msg.games) {
				gamesById[game.channelId] = parseGameChannel(gamesById[game.channelId], game);
			}
		}

		const nextState = { ...prevState, gamesById };

		// Channel membership
		if (msg.type === 'GLOBAL_GAMES_JOIN' && chanId) {
			const chanMem: ChannelMembership = { ...prevState.channelMembership };
			chanMem[chanId] = {
				type: 'gameList',
				complete: false,
				stale: false
			};
			nextState.channelMembership = chanMem;
		}

		return nextState;
	} else if (msg.type === 'GAME_CONTAINER_REMOVE_GAME' && chanId) {
		// Note - we don't actually track game/channel associations other than roomId,
		// which is attached to the game channel record itself. We only remove games
		// that should be removed from all views (global list, room, game screen)
		const game = prevState.gamesById[msg.gameId];

		if (game) {
			const watching = prevState.channelMembership[msg.gameId];
			const inRoom = prevState.channelMembership[game.roomId];

			if (!watching && (!inRoom || (inRoom && game.roomId === chanId))) {
				const gamesById: Index<GameChannel> = { ...prevState.gamesById };
				gamesById[msg.gameId] = { ...game, deletedTime: Date.now() };
				const playChallengeId =
					prevState.playChallengeId === msg.gameId ? null : prevState.playChallengeId;
				return { ...prevState, gamesById, playChallengeId };
			}
		}
	} else if (
		(msg.type === 'GAME_JOIN' ||
			msg.type === 'GAME_UPDATE' ||
			msg.type === 'GAME_STATE' ||
			msg.type === 'GAME_NAME_CHANGE' ||
			msg.type === 'CHALLENGE_JOIN') &&
		chanId
	) {
		// Special case to remove game name
		if (msg.type === 'GAME_NAME_CHANGE' && !msg.name) {
			msg.name = null;
		}

		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const game = parseGameChannel(gamesById[chanId], msg);
		const summary = game.summary;
		gamesById[chanId] = game;
		const nextState = { ...prevState, gamesById };

		// Channel membership
		if (msg.type === 'GAME_JOIN' || msg.type === 'CHALLENGE_JOIN') {
			const chanMem: ChannelMembership = { ...prevState.channelMembership };
			chanMem[chanId] = {
				type: 'game',
				complete: false,
				stale: false
			};
			nextState.channelMembership = chanMem;

			if (prevState.watchGameId && summary && summary.timestamp === prevState.watchGameId) {
				nextState.watchGameId = chanId;
				// Never true: playGameId is always a channel id, never a timestamp
				// (left over from Shin KGS); kept so the behaviour stays the same.
			} else if (
				prevState.playGameId &&
				summary &&
				summary.timestamp === (prevState.playGameId as unknown)
			) {
				nextState.playGameId = chanId;
			}

			if (summary && summary.type === 'review') {
				nextState.reviewGameId = chanId;
			}
		}

		// Created a challenge
		if (msg.type === 'CHALLENGE_JOIN' && !prevState.playChallengeId) {
			nextState.playChallengeId = chanId;
		}

		return nextState;
	} else if (msg.type === 'GAME_REVIEW') {
		const oldGameId: number = msg.originalId;
		const newGameId: number = msg.review.channelId;
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const game = parseGameChannel(gamesById[oldGameId], msg.review);
		gamesById[newGameId] = game;
		const playGameId = prevState.playGameId === oldGameId ? newGameId : prevState.playGameId;
		const nextState = { ...prevState, gamesById, playGameId };
		const chanMem: ChannelMembership = { ...prevState.channelMembership };
		chanMem[newGameId] = {
			type: 'game',
			complete: false,
			stale: false
		};
		nextState.channelMembership = chanMem;
		return nextState;
	} else if (msg.type === 'GAME_NOTIFY') {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const gameId = msg.game.channelId;
		gamesById[gameId] = parseGameChannel(gamesById[gameId], msg.game);
		return { ...prevState, gamesById };
	} else if (msg.type === 'AUTOMATCH_PREFS') {
		return { ...prevState, automatchPrefs: msg as unknown as AutomatchPrefs };
	} else if (msg.type === 'AUTOMATCH_STATUS') {
		return { ...prevState, automatchEnabled: !!msg.enabled };
	} else if (msg.type === 'ARCHIVE_JOIN' && chanId) {
		const gameSummariesByUser: Index<Array<GameSummary>> = { ...prevState.gameSummariesByUser };
		const name = msg.user.name;
		const summaries = msg.games.map((g: any) => parseGameSummary(g));
		summaries.sort((a: GameSummary, b: GameSummary) => b.timestamp.localeCompare(a.timestamp));
		gameSummariesByUser[name] = summaries;
		const nextState = { ...prevState, gameSummariesByUser };
		// Channel membership
		const chanMem: ChannelMembership = { ...prevState.channelMembership };
		chanMem[chanId] = {
			type: 'archive',
			complete: false,
			stale: false
		};
		nextState.channelMembership = chanMem;
		return nextState;
	} else if (msg.type === 'ARCHIVE_GAMES_CHANGED') {
		// FIXME: hack - hardcoded to currentUser since the message doens't include
		// the user, and we only stay subscribed to archive for currentUser
		const gameSummariesByUser: Index<Array<GameSummary>> = { ...prevState.gameSummariesByUser };
		const name = prevState.currentUser ? prevState.currentUser.name : 'FIXME';
		const summaries = msg.games.map((g: any) => parseGameSummary(g));
		const oldSummaries = gameSummariesByUser[name];

		if (oldSummaries) {
			const mergedSummaries = [...oldSummaries];

			for (const summary of summaries) {
				const index = mergedSummaries.findIndex((s) => s.timestamp === summary.timestamp);

				if (index >= 0) {
					mergedSummaries[index] = summary;
				} else {
					mergedSummaries.push(summary);
				}
			}

			mergedSummaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
			gameSummariesByUser[name] = mergedSummaries;
		} else {
			summaries.sort((a: GameSummary, b: GameSummary) => b.timestamp.localeCompare(a.timestamp));
			gameSummariesByUser[name] = summaries;
		}

		return { ...prevState, gameSummariesByUser };
	} else if (msg.type === 'ARCHIVE_GAME_REMOVED') {
		// FIXME: hack - hardcoded to currentUser since the message doens't include
		// the user, and we only stay subscribed to archive for currentUser
		const gameSummariesByUser: Index<Array<GameSummary>> = { ...prevState.gameSummariesByUser };
		const name = prevState.currentUser ? prevState.currentUser.name : 'FIXME';
		const oldSummaries = gameSummariesByUser[name];

		if (oldSummaries) {
			gameSummariesByUser[name] = oldSummaries.filter(
				(summary) => summary.timestamp !== msg.timestamp
			);
			return { ...prevState, gameSummariesByUser };
		}
	} else if (msg.type === 'WATCH_FILTER_CHANGE') {
		return {
			...prevState,
			watchFilter: prevState.watchFilter ? { ...prevState.watchFilter, ...msg.filter } : msg.filter
		};
	} else if (msg.type === 'PLAY_FILTER_CHANGE') {
		return {
			...prevState,
			playFilter: prevState.playFilter ? { ...prevState.playFilter, ...msg.filter } : msg.filter
		};
	} else if (msg.type === 'WATCH_GAME') {
		return { ...prevState, watchGameId: msg.gameId, userDetailsRequest: null };
	} else if (msg.type === 'PLAY_CHALLENGE') {
		return { ...prevState, playChallengeId: msg.challengeId };
	} else if (msg.type === 'CLOSE_CHALLENGE' && chanId) {
		const challenge = { ...prevState.gamesById[chanId] };
		delete challenge.sentProposal;
		delete challenge.counterProposal;
		delete challenge.receivedProposals;
		return {
			...prevState,
			gamesById: { ...prevState.gamesById, [chanId]: challenge },
			playChallengeId: null
		};
	} else if (msg.type === 'CHALLENGE_DECLINE' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const challenge = { ...prevState.gamesById[chanId] };

		if (challenge.sentProposal) {
			challenge.sentProposal = { ...challenge.sentProposal, status: 'declined' };
			gamesById[chanId] = challenge;
			return { ...prevState, gamesById };
		}
	} else if (msg.type === 'START_CHALLENGE_DECLINE' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const challenge = { ...prevState.gamesById[chanId] };

		if (challenge.receivedProposals) {
			challenge.receivedProposals = challenge.receivedProposals.filter(
				(proposal) =>
					!proposal.players.some((p) => {
						const name = p.user ? p.user.name : p.name;
						return name === msg.name;
					})
			);
		}

		gamesById[chanId] = challenge;
		return { ...prevState, gamesById };
	} else if (msg.type === 'START_CHALLENGE_SUBMIT' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const sentProposal = { ...msg.proposal, status: 'pending' };
		const challenge = { ...gamesById[chanId], sentProposal };
		delete challenge.counterProposal;
		gamesById[chanId] = challenge;
		return { ...prevState, gamesById };
	} else if (msg.type === 'CHALLENGE_COUNTER' && chanId && prevState.gamesById[chanId]) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		gamesById[chanId] = { ...gamesById[chanId], counterProposal: msg.proposal };
		return { ...prevState, gamesById };
	} else if (msg.type === 'CHALLENGE_SUBMIT' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const receivedProposals = gamesById[chanId].receivedProposals
			? [...gamesById[chanId].receivedProposals]
			: [];
		receivedProposals.push(msg.proposal);
		gamesById[chanId] = { ...gamesById[chanId], receivedProposals };
		return { ...prevState, gamesById };
	} else if (msg.type === 'CHALLENGE_FINAL') {
		const currentUser = prevState.currentUser;
		const name = currentUser && currentUser.name;
		const isPlayer = name && isGameProposalPlayer(name, msg.proposal);
		const nextState = { ...prevState, playChallengeId: null };

		if (isPlayer) {
			nextState.playGameId = msg.gameChannelId;
		} else {
			nextState.watchGameId = msg.gameChannelId;
		}

		return nextState;
	} else if (msg.type === 'PLAY_GAME') {
		return { ...prevState, playGameId: msg.gameId, userDetailsRequest: null };
	} else if (msg.type === 'GAME_UNDO_REQUEST' && chanId) {
		// Note - API returns a weird response for role
		const rawRole = msg.role;
		let role;

		if (typeof rawRole === 'string') {
			const matches = msg.role.match(/\[([^\]]+)\]/);
			role = (matches && matches[1]) || msg.role;
		} else if (rawRole === 4) {
			role = 'black';
		} else if (rawRole === 2) {
			role = 'white';
		} else {
			throw Error('Unrecognized role');
		}

		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		gamesById[chanId] = { ...gamesById[chanId], undoRequest: role };
		return { ...prevState, gamesById };
	} else if (msg.type === 'GAME_UNDO_DECLINE' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		gamesById[chanId] = { ...gamesById[chanId] };
		delete gamesById[chanId].undoRequest;
		return { ...prevState, gamesById };
	} else if (msg.type === 'START_GAME_MOVE' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		gamesById[chanId] = { ...gamesById[chanId] };
		let tree = gamesById[chanId].tree;

		if (tree) {
			tree = { ...tree };
			tree.pendingMove = {
				nodeId: tree.activeNode,
				color: msg.color,
				loc: msg.loc
			};
			tree.computedState = computeGameNodeStates(tree, tree.activeNode);
			gamesById[chanId].tree = tree;
			return { ...prevState, gamesById };
		}
	} else if (msg.type === 'GAME_MOVE_FAILED' && chanId && prevState.gamesById[chanId]) {
		// The move did not reach KGS: off the board again, with a notice.
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const game = { ...gamesById[chanId], moveFailed: true };
		if (game.tree?.pendingMove) {
			const tree = { ...game.tree };
			delete tree.pendingMove;
			tree.computedState = computeGameNodeStates(tree, tree.activeNode);
			game.tree = tree;
		}
		gamesById[chanId] = game;
		return { ...prevState, gamesById };
	} else if (msg.type === 'USER_REMOVED' && chanId && prevState.gamesById[chanId]) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const users = gamesById[chanId].users;

		if (!users) {
			return prevState;
		}

		gamesById[chanId] = {
			...gamesById[chanId],
			users: users.filter((name) => name !== msg.user.name)
		};
		const receivedProposals = gamesById[chanId].receivedProposals;

		if (receivedProposals) {
			// Remove proposals if this user was a challenger
			gamesById[chanId].receivedProposals = receivedProposals.filter(
				(proposal) =>
					!proposal.players.some(
						(p) => (p.name && p.name === msg.user.name) || (p.user && p.user.name === msg.user.name)
					)
			);
		}

		return { ...prevState, gamesById };
	} else if (msg.type === 'USER_ADDED' && chanId && prevState.gamesById[chanId]) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		const users = gamesById[chanId].users;

		if (!users || users.find((name) => name === msg.user.name)) {
			return prevState;
		}

		gamesById[chanId] = { ...gamesById[chanId], users: [...users, msg.user.name] };
		return { ...prevState, gamesById };
	} else if (msg.type === 'CHANNEL_SUBSCRIBERS_ONLY' && chanId) {
		const gamesById: Index<GameChannel> = {
			...prevState.gamesById,
			[chanId]: { ...prevState.gamesById[chanId], accessDenied: 'KGS Plus Subscribers Only' }
		};
		return { ...prevState, gamesById };
	} else if (msg.type === 'PRIVATE_KEEP_OUT' && chanId) {
		const game = prevState.gamesById[chanId];

		if (!game) {
			return prevState;
		}

		const gamesById: Index<GameChannel> = {
			...prevState.gamesById,
			[chanId]: { ...prevState.gamesById[chanId], accessDenied: 'Private Game' }
		};
		return { ...prevState, gamesById };
	} else if (msg.type === 'SET_CURRENT_GAME_NODE' && chanId) {
		const gamesById: Index<GameChannel> = { ...prevState.gamesById };
		gamesById[chanId] = { ...gamesById[chanId] };
		let tree = gamesById[chanId].tree;

		if (tree) {
			tree = { ...tree };
			tree.currentNode = msg.currentNode;

			if (tree.currentLine.indexOf(tree.currentNode) === -1) {
				tree.currentLine = getGameLine(tree, tree.currentNode);
			}

			gamesById[chanId].tree = tree;
			return { ...prevState, gamesById };
		}
	}

	return prevState;
}

export function handleGameMessage(prevState: AppState, msg: KgsMessage): AppState {
	let nextState = _handleGameMessage(prevState, msg);

	const currentUser = nextState.currentUser;
	const gamesChanged = prevState.gamesById !== nextState.gamesById;

	// If games changed, separate active games from challenges; sort
	if (gamesChanged) {
		const allGames = Object.keys(nextState.gamesById).map((id) => nextState.gamesById[id]);
		const activeGames = allGames.filter((g) => g.type !== 'challenge' && !g.deletedTime);
		sortGames(activeGames);
		const challenges = allGames.filter((g) => g.type === 'challenge' && !g.deletedTime);
		sortGames(challenges);
		nextState = { ...nextState, activeGames, challenges };
	}

	if (currentUser) {
		const name = currentUser.name;
		const summariesChanged =
			prevState.gameSummariesByUser[name] !== nextState.gameSummariesByUser[name];
		if (gamesChanged || summariesChanged) {
			const unfinishedGames = getUnfinishedGames(
				nextState.activeGames,
				nextState.gameSummariesByUser[name] || [],
				name
			);
			nextState = { ...nextState, unfinishedGames };
		}
	}

	return nextState;
}

// Own unfinished games, as CGoban's "Fortsetzen": games running right now
// (from the game lists), then every unfinished game of the own archive - the
// ones still open on KGS (opponent waiting, `inPlay`) first, then by date.
// An open archive game that is also in the game lists is listed once.
export function getUnfinishedGames(
	activeGames: Array<GameChannel>,
	summaries: Array<GameSummary>,
	name: string
): Array<UnfinishedGame> {
	const channels = activeGames.filter((g) => isGamePlayer(name, g.players) && isGamePlaying(g));
	const pairKey = (players: GameChannel['players'] | GameSummary['players']) =>
		[players.white?.name, players.black?.name].sort().join('|');
	const runningPairs = new Set(channels.map((g) => pairKey(g.players)));
	const open = summaries.filter((s) => s.score === 'UNFINISHED');
	const ordered = [
		...open.filter((s) => s.inPlay && !runningPairs.has(pairKey(s.players))),
		...open.filter((s) => !s.inPlay)
	];
	return [
		...channels.map((game): UnfinishedGame => ({ type: 'channel', game })),
		...ordered.map((game): UnfinishedGame => ({ type: 'summary', game }))
	];
}
