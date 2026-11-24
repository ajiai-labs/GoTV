import type { Message } from '../types.ts';

// A KGS game: the game screen and its parts (src/lib/ui/game/, GameScreen and
// the components it shows) and the game texts of gameText.ts.
export const game = {
	// Shared
	'game.move': 'Zug {move}',
	'game.more': 'Mehr',
	'game.color.white': 'Weiß',
	'game.color.black': 'Schwarz',

	// GameScreen
	'game.screen.over': 'Partie beendet',
	'game.screen.overWithScore': 'Partie beendet: {score}',
	'game.screen.back': 'Zurück',
	'game.screen.board': 'Brett',
	'game.screen.broadcast': 'Übertragung',
	'game.screen.live': 'Live: {name}',
	'game.screen.splitter': 'Brett größer oder kleiner',
	'game.screen.splitterValue': 'Brettbreite {width} Pixel',
	'game.screen.splitterFitValue': 'Brettbreite {width} Pixel, Seitenleiste {side} Pixel',
	'game.screen.tabs': 'Ansicht',
	'game.screen.tabChat': 'Chat',
	'game.screen.tabInfo': 'Info',
	'game.screen.observers': '{count} Beobachter',

	// GameMoreMenu
	'game.moreMenu.downloadSgf': 'SGF herunterladen',
	'game.moreMenu.openGoKibitz': 'In GoKibitz öffnen',
	'game.moreMenu.openEidoGo': 'In EidoGo öffnen',
	'game.moreMenu.gameInfo': 'Partieinfo',
	'game.moreMenu.size': 'Größe',
	'game.moreMenu.id': 'ID',
	'game.moreMenu.date': 'Datum',
	'game.moreMenu.result': 'Ergebnis',
	'game.moreMenu.propBlack': '{label} (Schwarz)',
	'game.moreMenu.propWhite': '{label} (Weiß)',
	'game.moreMenu.annotator': 'Kommentar von',
	'game.moreMenu.copyright': 'Copyright',
	'game.moreMenu.event': 'Veranstaltung',
	'game.moreMenu.place': 'Ort',
	'game.moreMenu.playerTeam': 'Team',
	'game.moreMenu.round': 'Runde',
	'game.moreMenu.source': 'Quelle',
	'game.moreMenu.transcriber': 'Mitschrift von',

	// GamePlayActions
	'game.play.group': 'Partie',
	'game.play.done': 'Fertig',
	'game.play.pass': 'Passen',
	'game.play.undoTitle': 'Den Gegner bitten, den letzten Zug zurückzunehmen',
	'game.play.undo': 'Zug zurück',
	'game.play.confirmResign': 'Wirklich aufgeben?',
	'game.play.resignYes': 'Ja, aufgeben',
	'game.play.keepPlaying': 'Weiter spielen',
	'game.play.resign': 'Aufgeben',
	'game.play.addOneMinute': '1 Minute schenken',
	'game.play.addFiveMinutes': '5 Minuten schenken',
	'game.play.leave': 'Partie verlassen',

	// GamePlayersInfo, GamePlayersList
	'game.players.owner': 'Besitzer der Partie',
	'game.players.captures': '{count} Gefangene',
	'game.players.winnerBadge': '✓ Sieger',
	'game.players.winnerPrefix': 'Gewinner: ',

	// GameChat
	'game.chat.start': 'Partiebeginn',

	// GameInfo
	'game.info.name': 'Name',
	'game.info.type': 'Art',
	'game.info.handicap': 'Vorgabe',
	'game.info.komi': 'Komi',
	'game.info.time': 'Zeit',
	'game.info.rules': 'Regeln',
	'game.info.room': 'Raum',

	// BoardContainer (the board's text for screen readers)
	'game.board.labelPlayers': 'Brett {white} (Weiß) gegen {black} (Schwarz), Zug {move}',
	'game.board.labelOne': 'Brett {name}, Zug {move}',
	'game.board.label': 'Brett, Zug {move}',

	// GameRulesDisplay, GameTimeSystem
	'game.rules.komi': 'Komi {komi}',
	'game.time.none': 'Ohne Zeitlimit',
	'game.time.absolute': 'absolut',
	'game.time.veryFast': 'sehr schnell',
	'game.time.fast': 'schnell',
	'game.time.slow': 'langsam',

	// GameUndoPrompt
	'game.undo.request': 'Bitte um Zugrücknahme.',
	'game.undo.allow': 'Erlauben',
	'game.undo.decline': 'Ablehnen',

	// GameReplaySuggestion
	'game.replay.over': 'Partie beendet.',
	'game.replay.replay': 'Nachspielen',
	'game.replay.review': 'Mit KataGo auswerten',
	'game.replay.close': 'Schließen',

	// GameTypeIcon
	'game.typeIcon.free': 'Freie Partie',
	'game.typeIcon.ranked': 'Gewertete Partie',
	'game.typeIcon.tournament': 'Turnierpartie',
	'game.typeIcon.subscribers': 'Nur für KGS-Plus-Abonnenten',
	'game.typeIcon.private': 'Private Partie',

	// gameText.ts: results ("S+Aufgabe"), game types, rulesets, chat actions
	'game.result.black': 'S',
	'game.result.white': 'W',
	'game.result.resign': 'Aufgabe',
	'game.result.time': 'Zeit',
	'game.result.forfeit': 'kampflos',
	'game.result.unknown': 'Unbekannt',
	'game.result.unfinished': 'Nicht beendet',
	'game.result.noResult': 'Kein Ergebnis',
	'game.type.challenge': 'Herausforderung',
	'game.type.demonstration': 'Demonstration',
	'game.type.review': 'Besprechung',
	'game.type.rengoReview': 'Rengo-Besprechung',
	'game.type.teaching': 'Lehrpartie',
	'game.type.simul': 'Simultan',
	'game.type.rengo': 'Rengo',
	'game.type.free': 'Frei',
	'game.type.ranked': 'Gewertet',
	'game.type.tournament': 'Turnier',
	'game.ruleset.japanese': 'Japanisch',
	'game.ruleset.chinese': 'Chinesisch',
	'game.ruleset.aga': 'AGA',
	'game.ruleset.newZealand': 'Neuseeländisch',
	'game.action.blackPassed': 'Schwarz passt',
	'game.action.whitePassed': 'Weiß passt',
	'game.action.gameOver': 'Partie beendet: {result}'
} satisfies Record<string, Message>;
