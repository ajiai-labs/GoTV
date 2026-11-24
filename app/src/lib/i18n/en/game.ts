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
	'game.screen.back': 'Back',
	'game.screen.board': 'Board',
	'game.screen.broadcast': 'Broadcast',
	'game.screen.live': 'Live: {name}',
	'game.screen.splitter': 'Make the board bigger or smaller',
	'game.screen.splitterValue': 'Board width {width} pixels',
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
