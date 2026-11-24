import type { Message } from '../types.ts';

// Nachspielen: SgfReplayView, KataGo, game graph, replay lists, "Meine Daten".
export const replay = {
	// shared
	'replay.black': 'Schwarz',
	'replay.white': 'Weiß',
	'replay.pass': 'Passen',
	'replay.move': 'Zug {move}',
	'replay.cancel': 'Abbrechen',

	// SgfReplayView
	'replay.view.koNotice': 'Ko: sofort zurückschlagen ist verboten – erst woanders spielen.',
	'replay.view.suicideNotice': 'Selbstmord: Der Stein hätte keine Freiheit.',
	'replay.view.corsError':
		'SGF konnte nicht geladen werden. Wahrscheinlich blockiert der Server direkte Anfragen (CORS). Lade die Datei direkt hoch oder füge den SGF-Text ein.',
	'replay.view.exampleError':
		'Finalpartie konnte nicht geladen werden. Schließe das Beispiel und öffne es erneut.',
	'replay.view.parseError': 'SGF konnte nicht gelesen werden: {error}',
	'replay.view.untitled': 'SGF-Partie',
	'replay.view.continuationGame': 'Partie {point}',
	'replay.view.continuationKataGo': 'KataGo {point}',
	'replay.view.continuationVariation': 'Variante {point}',
	'replay.view.boardLabel': 'Brett nach Zug {move}',
	'replay.view.boardLabelPlayers': '{black} gegen {white}, Brett nach Zug {move}',
	'replay.view.colorInParens': '({color})',
	'replay.view.versus': 'gegen',
	'replay.view.captures': 'Zug {move} · Gefangene: Schwarz {black}, Weiß {white}',
	'replay.view.variation': 'Variante ab Zug {move} · {color} ist am Zug',
	'replay.view.backToGame': 'Zurück zur Partie',
	'replay.view.removeVariation': 'Variante löschen',
	'replay.view.continueWith': 'Weiter mit:',
	'replay.view.comment': 'Kommentar:',
	'replay.view.resumed': 'Weiter bei Zug {move} – hier hast du zuletzt aufgehört.',
	'replay.view.restart': 'Von vorn',
	'replay.view.bookmarks': 'Lesezeichen',
	'replay.view.bookmarkNote': 'Zug {move}: {note}',
	'replay.view.removeBookmark': 'Lesezeichen bei Zug {move} löschen',
	'replay.view.exportSgf': 'Als SGF speichern',
	'replay.view.addBookmark': 'Lesezeichen bei Zug {move}',
	'replay.view.notePlaceholder': 'z. B. Hier verstehe ich den Kampf nicht',
	'replay.view.noteLabel': 'Notiz zu Zug {move}',
	'replay.view.save': 'Speichern',
	'replay.view.loadOther': 'Andere Partie laden',
	'replay.view.load': 'Partie laden',
	'replay.view.sgfFile': 'SGF-Datei:',
	'replay.view.pasteSgf': 'SGF einfügen:',
	'replay.view.loadButton': 'Laden',
	'replay.view.loadingExample': 'Finalpartie wird geladen …',
	'replay.view.unknownError': 'Unbekannter Fehler',

	// KataGoPanel
	'replay.katago.percent': '{value} %',
	'replay.katago.even': 'ausgeglichen',
	'replay.katago.lead': '{color} führt mit {points} Punkten',
	'replay.katago.lineComment': 'KataGo-Variante: {point} · Schwarz {winRate} · {lead}',
	'replay.katago.compareSame': 'Die Partie spielte {played} – auch KataGos erste Wahl.',
	'replay.katago.compareWorse':
		'Die Partie spielte {played}: laut KataGo {points} Punkte schlechter als {best}.',
	'replay.katago.compareNotListed':
		'Die Partie spielte {played} – nicht unter KataGos {count} besten Zügen; KataGo bevorzugt {best}.',
	'replay.katago.title': 'KataGo-Analyse',
	'replay.katago.visits': 'Visits',
	'replay.katago.visitCount': '{visits} Visits',
	'replay.katago.network': 'Netz: {name}',
	'replay.katago.smallNetwork': 'klein (b6, mitgeliefert)',
	'replay.katago.loadNetwork': 'Stärkeres Netz laden …',
	'replay.katago.offHint':
		'rechnet im Browser, nichts wird verschickt; zeigt Bewertung und bessere Züge erst nach dem Einschalten',
	'replay.katago.evaluating': 'Partie wird ausgewertet … Zug {done} von {total}',
	'replay.katago.checking': 'Auffällige Züge werden mit KataGo-Suche geprüft … {done} von {total}',
	'replay.katago.evaluateGame': 'Ganze Partie auswerten',
	'replay.katago.evaluationFailed': 'Auswertung fehlgeschlagen: {error}',
	'replay.katago.evaluateHint': 'Gewinnkurve und die größten Fehler; zeigt den Partieverlauf',
	'replay.katago.failed': 'KataGo konnte nicht rechnen: {error}',
	'replay.katago.unknownError': 'unbekannter Fehler',
	'replay.katago.running': 'KataGo rechnet … (beim ersten Mal wird das Netz geladen)',
	'replay.katago.winRate': 'Gewinnchance Schwarz {winRate}',
	'replay.katago.expected': '· erwartet {line}',
	'replay.katago.layLine': 'Variante legen',
	// KataGoEngine (errors shown in the panel)
	'replay.katago.startFailed': 'KataGo konnte nicht starten',
	'replay.katago.analysisFailed': 'Analyse fehlgeschlagen',

	// GameGraph
	'replay.graph.label': 'Gewinnchance Schwarz über die ganze Partie',
	'replay.graph.valueText': 'Zug {move}, Schwarz {percent} Prozent',
	'replay.graph.legend':
		'oben Schwarz vorn, unten Weiß · Klick auf die Kurve springt zum Zug · Fehler nach verlorener Gewinnchance, Punkte mit KataGo-Suche geprüft; das mitgelieferte kleine Netz ist in Ko-Kämpfen ungenau',
	'replay.graph.mistakesTitle': 'Partieentscheidende Fehler:',
	'replay.graph.mistakeTitle': 'Stellung vor dem Zug zeigen – KataGo zeigt dort den besseren Zug',
	'replay.graph.mistake': 'Zug {move} · {color} {point}: −{winRate} % · −{points} Punkte',
	'replay.graph.noMistakes': 'Keine Züge, die 2 Punkte oder mehr verloren haben.',

	// RecentReplays
	'replay.recent.justEnded': 'Gerade zu Ende – Partien nachspielen',
	'replay.recent.title': 'Turnierpartien der letzten {months} Monate',
	'replay.recent.replaySgf': 'SGF nachspielen',
	'replay.recent.empty': 'Keine Turnierpartien aus den letzten Monaten.',

	// RecentlyReplayed
	'replay.recently.title': 'Zuletzt nachgespielt',
	'replay.recently.resume': 'weiter bei Zug {move}',
	'replay.recently.bookmarks': { one: '{count} Lesezeichen', other: '{count} Lesezeichen' },

	// ReplayGameList
	'replay.games.ogsUnreachable': 'OGS nicht erreichbar',
	'replay.games.hide': 'Partien ausblenden',
	'replay.games.replayCount': {
		one: '{count} Partie nachspielen',
		other: '{count} Partien nachspielen'
	},
	'replay.games.replay': 'Partien nachspielen',
	'replay.games.loading': 'Partien werden bei OGS gesucht …',
	'replay.games.error': 'Partien konnten nicht geladen werden ({error}).',
	'replay.games.retry': 'Erneut versuchen',
	'replay.games.none': 'Noch keine beendete Partie gefunden.',

	// BackupPanel
	'replay.backup.favoriteChannels': {
		one: '{count} Lieblingskanal',
		other: '{count} Lieblingskanäle'
	},
	'replay.backup.favoriteEvents': {
		one: '{count} Lieblingsturnier',
		other: '{count} Lieblingsturniere'
	},
	'replay.backup.games': {
		one: '{count} nachgespielte Partie',
		other: '{count} nachgespielte Partien'
	},
	'replay.backup.bookmarks': { one: '{count} Lesezeichen', other: '{count} Lesezeichen' },
	'replay.backup.variationMoves': { one: '{count} Variantenzug', other: '{count} Variantenzüge' },
	'replay.backup.settings': { one: '{count} Einstellung', other: '{count} Einstellungen' },
	'replay.backup.noData': 'keine Daten',
	'replay.backup.unknownDate': 'unbekanntem Datum',
	'replay.backup.dateTime': '{date}, {time} Uhr',
	'replay.backup.noStorage': 'Dieser Browser speichert keine Daten.',
	'replay.backup.saved': 'Sicherung gespeichert: {summary}.',
	'replay.backup.unreadable': 'Die Datei konnte nicht gelesen werden.',
	'replay.backup.restored': 'Sicherung übernommen. GoTV lädt neu …',
	'replay.backup.nothingNew': 'Nichts zu übernehmen – diese Daten sind schon hier.',
	'replay.backup.title': 'Meine Daten',
	'replay.backup.hint':
		'Favoriten, nachgespielte Partien mit Lesezeichen und Varianten, Einstellungen – nur in diesem Browser. Mit einer Sicherungsdatei nimmst du sie auf ein anderes Gerät mit.',
	'replay.backup.save': 'Sicherung speichern',
	'replay.backup.load': 'Sicherung einspielen …',
	'replay.backup.pending': 'Sicherung vom {date}: {summary}.',
	'replay.backup.restoreHint':
		'Einspielen ergänzt nur: Was hier schon gespeichert ist, bleibt erhalten; bei derselben Partie gilt der neuere Stand.',
	'replay.backup.restore': 'Einspielen',
	// Backup.ts (file name, errors of a chosen file)
	'replay.backup.fileName': 'gotv-sicherung-{date}.json',
	'replay.backup.errorNotJson': 'Die Datei ist keine GoTV-Sicherung (kein JSON).',
	'replay.backup.errorFormat': 'Die Datei ist keine GoTV-Sicherung.',
	'replay.backup.errorVersion':
		'Die Sicherung stammt aus einer neueren GoTV-Version. Bitte GoTV aktualisieren.',
	'replay.backup.errorEmpty': 'Die Sicherung enthält keine Daten.',
	'replay.backup.errorTooBig': 'Die Sicherung ist zu groß.'
} satisfies Record<string, Message>;
