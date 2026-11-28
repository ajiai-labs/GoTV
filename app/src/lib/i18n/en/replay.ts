import type { replay as de } from '../de/replay.ts';
import type { Translation } from '../types.ts';

export const replay: Translation<typeof de> = {
	// shared
	'replay.black': 'Black',
	'replay.white': 'White',
	'replay.pass': 'Pass',
	'replay.move': 'Move {move}',
	'replay.cancel': 'Cancel',

	// SgfReplayView
	'replay.view.koNotice': 'Ko: you can’t take back at once – play elsewhere first.',
	'replay.view.suicideNotice': 'Suicide: the stone would have no liberties.',
	'replay.view.corsError':
		'Could not load the SGF. The server probably blocks direct requests (CORS). Upload the file instead or paste the SGF text.',
	'replay.view.exampleError': 'Could not load the final game. Close the example and open it again.',
	'replay.view.parseError': 'Could not read the SGF: {error}',
	'replay.view.untitled': 'SGF game',
	'replay.view.continuationGame': 'Game {point}',
	'replay.view.continuationKataGo': 'KataGo {point}',
	'replay.view.continuationVariation': 'Variation {point}',
	'replay.view.boardLabel': 'Board after move {move}',
	'replay.view.boardLabelPlayers': '{black} vs {white}, board after move {move}',
	'replay.view.colorInParens': '({color})',
	'replay.view.versus': 'vs',
	'replay.view.captures': 'Move {move} · Captures: Black {black}, White {white}',
	'replay.view.variation': 'Variation from move {move} · {color} to play',
	'replay.view.backToGame': 'Back to the game',
	'replay.view.removeVariation': 'Delete variation',
	'replay.view.continueWith': 'Continue with:',
	'replay.view.comment': 'Comment:',
	'replay.view.resumed': 'Resuming at move {move} – where you left off last time.',
	'replay.view.restart': 'From the start',
	'replay.view.bookmarks': 'Bookmarks',
	'replay.view.bookmarkNote': 'Move {move}: {note}',
	'replay.view.removeBookmark': 'Delete bookmark at move {move}',
	'replay.view.exportBlocked': 'Only once the game on KGS is over – no help during a running game.',
	'replay.view.exportSgf': 'Save as SGF',
	'replay.view.copyLink': 'Copy link',
	'replay.view.linkCopied': 'Link copied',
	'replay.view.linkField': 'Link to this game at move {move}',
	'replay.view.linkSelect': 'The link is selected: copy it with Ctrl+C or via Share.',
	'replay.view.linkNoFile':
		'Sharing works only for games loaded from an address, not for files or pasted SGF.',
	'replay.view.linkNoKgs': 'Sharing is not possible: KGS games have no public address.',
	'replay.view.linkNotPublic': 'Sharing is not possible: this address is not public.',
	'replay.view.addBookmark': 'Bookmark move {move}',
	'replay.view.notePlaceholder': 'e.g. I don’t understand this fight',
	'replay.view.noteLabel': 'Note on move {move}',
	'replay.view.save': 'Save',
	'replay.view.loadOther': 'Load another game',
	'replay.view.load': 'Load a game',
	'replay.view.sgfFile': 'SGF file:',
	'replay.view.pasteSgf': 'Paste SGF:',
	'replay.view.loadButton': 'Load',
	'replay.view.loadingExample': 'Loading the final game …',
	'replay.view.unknownError': 'Unknown error',

	// KataGoPanel
	'replay.katago.percent': '{value}%',
	'replay.katago.even': 'even',
	'replay.katago.lead': '{color} leads by {points} points',
	'replay.katago.lineComment': 'KataGo variation: {point} · Black {winRate} · {lead}',
	'replay.katago.compareSame': 'The game played {played} – also KataGo’s first choice.',
	'replay.katago.compareWorse':
		'The game played {played}: {points} points worse than {best}, according to KataGo.',
	'replay.katago.compareNotListed':
		'The game played {played} – not among KataGo’s {count} best moves; KataGo prefers {best}.',
	'replay.katago.title': 'KataGo analysis',
	'replay.katago.blockedRunning':
		'KataGo is only available after the game – this game is still running on KGS. Variations and bookmarks work already.',
	'replay.katago.visits': 'Visits',
	'replay.katago.visitCount': '{visits} visits',
	'replay.katago.network': 'Network: {name}',
	'replay.katago.smallNetwork': 'small (b6, included)',
	'replay.katago.loadNetwork': 'Load a stronger network …',
	'replay.katago.offHint':
		'runs in the browser, nothing is sent; shows the evaluation and better moves only once switched on',
	'replay.katago.evaluating': 'Evaluating the game … move {done} of {total}',
	'replay.katago.checking': 'Checking suspicious moves with a KataGo search … {done} of {total}',
	'replay.katago.evaluateGame': 'Evaluate the whole game',
	'replay.katago.evaluationFailed': 'Evaluation failed: {error}',
	'replay.katago.evaluateHint':
		'Win-rate graph and the biggest mistakes; reveals how the game went',
	'replay.katago.failed': 'KataGo could not analyse: {error}',
	'replay.katago.unknownError': 'unknown error',
	'replay.katago.running': 'KataGo is thinking … (the network loads the first time)',
	'replay.katago.winRate': 'Black’s win rate {winRate}',
	'replay.katago.expected': '· expected {line}',
	'replay.katago.layLine': 'Add as variation',
	'replay.katago.startFailed': 'KataGo could not start',
	'replay.katago.analysisFailed': 'Analysis failed',

	// GameGraph
	'replay.graph.label': 'Black’s win rate over the whole game',
	'replay.graph.valueText': 'Move {move}, Black {percent} percent',
	'replay.graph.legend':
		'Black ahead at the top, White at the bottom · click the graph to jump to a move · mistakes by lost win rate, points checked with a KataGo search; the small included network is inaccurate in ko fights',
	'replay.graph.mistakesTitle': 'Decisive mistakes:',
	'replay.graph.mistakeTitle':
		'Show the position before the move – KataGo shows the better move there',
	'replay.graph.mistake': 'Move {move} · {color} {point}: −{winRate}% · −{points} points',
	'replay.graph.noMistakes': 'No moves that lost 2 points or more.',

	// RecentReplays
	'replay.recent.justEnded': 'Just ended – replay the games',
	'replay.recent.title': 'Tournament games of the last {months} months',
	'replay.recent.replaySgf': 'Replay SGF',
	'replay.recent.empty': 'No tournament games from the last few months.',

	// RecentlyReplayed
	'replay.recently.title': 'Recently replayed',
	'replay.recently.resume': 'continue at move {move}',
	'replay.recently.bookmarks': { one: '{count} bookmark', other: '{count} bookmarks' },

	// ReplayGameList
	'replay.archive.download': {
		one: 'Download game (ZIP)',
		other: 'Download all {count} games (ZIP)'
	},
	'replay.archive.loading': 'Loading game {done} of {total} …',
	'replay.archive.done': 'Downloaded: SGF files and the list of games in one ZIP file.',
	'replay.archive.doneMissing': 'Downloaded – {games} missing, OGS did not deliver them just now.',
	'replay.archive.error': 'OGS delivered no game. Please try again later.',
	'replay.archive.source': 'Games from OGS (online-go.com), downloaded with GoTV.',
	'replay.archive.missingList': 'Not loaded: {games}',
	'replay.games.ogsUnreachable': 'OGS unreachable',
	'replay.games.hide': 'Hide games',
	'replay.games.replayCount': { one: 'Replay {count} game', other: 'Replay {count} games' },
	'replay.games.replay': 'Replay games',
	'replay.games.loading': 'Looking for the games on OGS …',
	'replay.games.error': 'Could not load the games ({error}).',
	'replay.games.retry': 'Try again',
	'replay.games.none': 'No finished game found yet.',

	// BackupPanel
	'replay.backup.favoriteChannels': {
		one: '{count} favourite channel',
		other: '{count} favourite channels'
	},
	'replay.backup.favoriteEvents': {
		one: '{count} favourite tournament',
		other: '{count} favourite tournaments'
	},
	'replay.backup.games': { one: '{count} replayed game', other: '{count} replayed games' },
	'replay.backup.bookmarks': { one: '{count} bookmark', other: '{count} bookmarks' },
	'replay.backup.variationMoves': {
		one: '{count} variation move',
		other: '{count} variation moves'
	},
	'replay.backup.settings': { one: '{count} setting', other: '{count} settings' },
	'replay.backup.setting.design': 'design',
	'replay.backup.setting.tone': 'tone',
	'replay.backup.setting.language': 'language',
	'replay.backup.setting.navOrder': 'menu',
	'replay.backup.setting.sounds': 'sounds',
	'replay.backup.setting.stoneSound': 'stone click sound',
	'replay.backup.setting.startSound': 'game start sound',
	'replay.backup.setting.messageSound': 'chat message sound',
	'replay.backup.setting.countdownSound': 'sound of the last seconds',
	'replay.backup.setting.gameWindows': 'game windows',
	'replay.backup.setting.katago': 'KataGo',
	'replay.backup.noData': 'no data',
	'replay.backup.unknownDate': 'an unknown date',
	'replay.backup.dateTime': '{date}, {time}',
	'replay.backup.noStorage': 'This browser does not store any data.',
	'replay.backup.saved': 'Backup saved: {summary}.',
	'replay.backup.unreadable': 'Could not read the file.',
	'replay.backup.restored': 'Backup restored. GoTV is reloading …',
	'replay.backup.nothingNew': 'Nothing to restore – this data is already here.',
	'replay.backup.title': 'My data',
	'replay.backup.hint':
		'Favourites, replayed games with bookmarks and variations, settings – only in this browser. With a backup file you can take them to another device.',
	'replay.backup.save': 'Save backup',
	'replay.backup.load': 'Restore backup …',
	'replay.backup.pending': 'Backup from {date}: {summary}.',
	'replay.backup.restoreHint':
		'Restoring only adds: what is already stored here stays; for the same game the newer state wins.',
	'replay.backup.restore': 'Restore',
	'replay.backup.fileName': 'gotv-backup-{date}.json',
	'replay.backup.errorNotJson': 'The file is not a GoTV backup (not JSON).',
	'replay.backup.errorFormat': 'The file is not a GoTV backup.',
	'replay.backup.errorVersion': 'The backup comes from a newer GoTV version. Please update GoTV.',
	'replay.backup.errorEmpty': 'The backup holds no data.',
	'replay.backup.errorTooBig': 'The backup is too big.'
};
