import type { game as de } from '../de/game.ts';
import type { Translation } from '../types.ts';

export const game: Translation<typeof de> = {
	// Shared
	'game.move': 'Move {move}',
	'game.more': 'More',
	'game.color.white': 'White',
	'game.color.black': 'Black',

	// GameScreen
	'game.screen.over': 'Game over',
	'game.screen.overWithScore': 'Game over: {score}',
	'game.screen.closeWindow': 'Close window',
	'game.screen.ownWindow': 'Own window',
	'game.screen.ownWindowHint': 'Show the game in a window of its own, as in CGoban',
	'game.screen.ownWindowRefused':
		'The browser did not open the window. Allow pop-ups for GoTV and try again.',
	'game.screen.back': 'Back',
	'game.screen.board': 'Board',
	'game.screen.broadcast': 'Broadcast',
	'game.screen.live': 'Live: {name}',
	'game.screen.splitter': 'Make the board bigger or smaller',
	'game.screen.splitterValue': 'Board width {width} pixels',
	'game.screen.moveFailed':
		'Move did not reach KGS – please play it again once the connection is back.',
	'game.screen.splitterFitValue': 'Board width {width} pixels, sidebar {side} pixels',
	'game.screen.tabs': 'View',
	'game.screen.tabChat': 'Chat',
	'game.screen.tabInfo': 'Info',
	'game.screen.observers': { one: '{count} observer', other: '{count} observers' },

	// GameMoreMenu
	'game.moreMenu.downloadSgf': 'Download SGF',
	'game.moreMenu.openGoKibitz': 'Open in GoKibitz',
	'game.moreMenu.openEidoGo': 'Open in EidoGo',
	'game.moreMenu.gameInfo': 'Game info',
	'game.estimate.title': 'Estimate score',
	'game.estimate.boardLabel': 'Board with estimated territory',
	'game.estimate.working': 'Estimating …',
	'game.estimate.even': 'About even',
	'game.estimate.leads': '{color} leads by about {points} points',
	'game.estimate.points': '{points} points',
	'game.estimate.pointsKomi': '{points} points (with {komi} komi)',
	'game.estimate.noBoard': 'This game has no board yet.',
	'game.estimate.note':
		'Rough estimate from many random games, no AI. Inaccurate in open fights. Crosses: stones that look dead.',
	'game.moreMenu.localCopy': 'View locally',
	'game.moreMenu.copyToRoom': 'Copy game to …',
	'game.moreMenu.copyText':
		'KGS creates a copy of the game as a review in one of your rooms. There you can try moves and discuss them with others.',
	'game.moreMenu.copyRoom': 'Room',
	'game.moreMenu.copySend': 'Copy',
	'game.moreMenu.copySent': 'The copy is being created and opens under "Watch" in a moment.',
	'game.moreMenu.copyNoRoom': 'You are not in any room. Join a room under "Chat" first.',
	'game.moreMenu.size': 'Size',
	'game.moreMenu.id': 'ID',
	'game.moreMenu.date': 'Date',
	'game.moreMenu.result': 'Result',
	'game.moreMenu.propBlack': '{label} (Black)',
	'game.moreMenu.propWhite': '{label} (White)',
	'game.moreMenu.annotator': 'Annotated by',
	'game.moreMenu.copyright': 'Copyright',
	'game.moreMenu.event': 'Event',
	'game.moreMenu.place': 'Place',
	'game.moreMenu.playerTeam': 'Team',
	'game.moreMenu.round': 'Round',
	'game.moreMenu.source': 'Source',
	'game.moreMenu.transcriber': 'Transcribed by',

	// GamePlayActions
	'game.play.group': 'Game',
	'game.play.done': 'Done',
	'game.play.pass': 'Pass',
	'game.play.undoTitle': 'Ask your opponent to take back the last move',
	'game.play.undo': 'Undo',
	'game.play.confirmResign': 'Really resign?',
	'game.play.resignYes': 'Yes, resign',
	'game.play.keepPlaying': 'Keep playing',
	'game.play.resign': 'Resign',
	'game.play.addOneMinute': 'Give 1 minute',
	'game.play.addFiveMinutes': 'Give 5 minutes',
	'game.play.leave': 'Leave game',
	'game.play.leaveTitle': 'Game not finished',
	'game.play.leaveText':
		'The game is not finished yet. If you leave now, your opponent waits for you – you can resume it later under "Play".',
	'game.play.leaveYes': 'Leave',
	'game.play.leaveBack': 'Back to the game',

	// GamePlayersInfo, GamePlayersList
	'game.players.owner': 'Game owner',
	'game.players.captures': { one: '{count} capture', other: '{count} captures' },
	'game.players.winnerBadge': '✓ Winner',
	'game.players.winnerPrefix': 'Winner: ',

	// GameChat
	'game.chat.start': 'Game start',

	// GameInfo
	'game.info.name': 'Name',
	'game.info.type': 'Type',
	'game.info.handicap': 'Handicap',
	'game.info.komi': 'Komi',
	'game.info.time': 'Time',
	'game.info.rules': 'Rules',
	'game.info.room': 'Room',

	// BoardContainer (the board's text for screen readers)
	'game.board.labelPlayers': 'Board {white} (White) vs {black} (Black), move {move}',
	'game.board.labelOne': 'Board {name}, move {move}',
	'game.board.label': 'Board, move {move}',

	// GameRulesDisplay, GameTimeSystem
	'game.rules.komi': 'Komi {komi}',
	'game.time.none': 'No time limit',
	'game.time.absolute': 'absolute',
	'game.time.veryFast': 'very fast',
	'game.time.fast': 'fast',
	'game.time.slow': 'slow',

	// GameUndoPrompt
	'game.undo.request': 'Undo requested.',
	'game.undo.allow': 'Allow',
	'game.undo.decline': 'Decline',

	// GameReplaySuggestion
	'game.replay.over': 'Game over.',
	'game.replay.replay': 'Replay',
	'game.replay.review': 'Review with KataGo',
	'game.replay.close': 'Close',

	// GameTypeIcon
	'game.typeIcon.free': 'Free game',
	'game.typeIcon.ranked': 'Ranked game',
	'game.typeIcon.tournament': 'Tournament game',
	'game.typeIcon.subscribers': 'KGS Plus subscribers only',
	'game.typeIcon.private': 'Private game',

	// gameText.ts: the original English texts of the game logic
	'game.result.black': 'B',
	'game.result.white': 'W',
	'game.result.resign': 'Resign',
	'game.result.time': 'Time',
	'game.result.forfeit': 'Forfeit',
	'game.result.unknown': 'Unknown',
	'game.result.unfinished': 'Unfinished',
	'game.result.noResult': 'No Result',
	'game.type.challenge': 'Challenge',
	'game.type.demonstration': 'Demonstration',
	'game.type.review': 'Review',
	'game.type.rengoReview': 'Rengo Review',
	'game.type.teaching': 'Teaching',
	'game.type.simul': 'Simul',
	'game.type.rengo': 'Rengo',
	'game.type.free': 'Free',
	'game.type.ranked': 'Ranked',
	'game.type.tournament': 'Tournament',
	'game.ruleset.japanese': 'Japanese',
	'game.ruleset.chinese': 'Chinese',
	'game.ruleset.aga': 'AGA',
	'game.ruleset.newZealand': 'New Zealand',
	'game.action.blackPassed': 'Black passed',
	'game.action.whitePassed': 'White passed',
	'game.action.gameOver': 'Game Over: {result}'
};
