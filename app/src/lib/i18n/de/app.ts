import type { Message } from '../types.ts';

// Layout, pages (Live, Kalender, Kanäle, Nachspielen, Konto, Suche,
// Beobachten, Spielen), shared parts (login, dialogs, board) and the calendar.
export const app = {
	// Navigation (routes/+layout.svelte)
	'app.nav.live': 'Live',
	'app.nav.calendar': 'Kalender',
	'app.nav.channels': 'Kanäle',
	'app.nav.replay': 'Nachspielen',
	'app.nav.watch': 'Beobachten',
	'app.nav.play': 'Spielen',
	'app.nav.chat': 'Chat',
	'app.nav.search': 'Suche',
	'app.nav.liveNow': 'gerade läuft eine Übertragung',
	'app.layout.home': 'GoTV, zu Live',
	'app.layout.areas': 'Bereiche',
	'app.layout.login': 'Anmelden',
	'app.layout.settings': 'Einstellungen',
	'app.layout.github': 'GoTV auf GitHub',
	'app.layout.openProject': 'Offenes Projekt – Fehler und Ideen gern dort melden.',

	// HomeScreenHint (web version on iPad and iPhone)
	'app.homeHint.title': 'GoTV als App',
	'app.homeHint.text':
		'Tippe auf Teilen {icon} und dann auf „Zum Home-Bildschirm“. GoTV startet dann wie eine App, ohne Adressleiste.',
	'app.homeHint.close': 'Hinweis schließen',

	// Live (routes/+page.svelte)
	'app.live.pageTitle': 'Live – GoTV',
	'app.live.streamFromChat': 'Stream aus dem Chat',
	'app.live.closeStream': 'Stream schließen',
	'app.live.noKgsBoard': 'Diesem Stream ist kein KGS-Brett zugeordnet.',
	'app.live.loading': 'Übertragungen werden geladen …',
	'app.live.runningNow': 'Läuft gerade',
	'app.live.noBroadcast': 'Gerade keine Übertragung.',
	'app.live.calendarError':
		'Der Kalender konnte nicht geladen werden (events.json nicht erreichbar).',
	'app.live.nextEvent': 'Nächstes Event:',
	'app.live.toCalendar': 'Zum Kalender',
	'app.live.onAirNow': 'Jetzt auf den Kanälen (geplant):',
	'app.live.toChannels': 'Zu den Kanälen',

	// Kanäle, Nachspielen, Beobachten (pages)
	'app.channels.pageTitle': 'Kanäle – GoTV',
	'app.channels.title': 'Kanäle',
	'app.replay.pageTitle': 'Nachspielen – GoTV',
	'app.replay.title': 'Nachspielen',
	'app.replay.back': 'Zurück',
	'app.watch.pageTitle': 'Beobachten – GoTV',
	'app.watch.title': 'Partien beobachten',

	// Spielen (routes/spielen)
	'app.play.pageTitle': 'Spielen – GoTV',
	'app.play.title': 'Spielen',
	'app.play.createChallenge': 'Herausforderung erstellen',
	'app.play.challenge': 'Herausforderung',
	'app.play.loadingChallenge': 'Herausforderung wird geladen …',
	'app.play.unfinished': 'Nicht beendete Partien',
	'app.play.resumeTitle': 'Nicht beendete Partie',
	'app.play.openChallenges': 'Offene Herausforderungen',

	// Konto (routes/konto)
	'app.account.pageTitle': 'Konto – GoTV',
	'app.account.title': 'Konto',
	'app.account.loggedIn': 'Angemeldet bei KGS',
	'app.account.viewProfile': 'Profil ansehen',
	'app.account.logout': 'Abmelden',
	'app.account.about': 'Über GoTV',
	'app.account.version': 'Version {version}',
	'app.account.sendFeedback': 'Feedback senden',
	'app.account.kgsWebsite': 'Offizielle KGS-Webseite',
	'app.account.origin':
		'GoTV ist aus Shin KGS von Justin Kramer entstanden (MIT-Lizenz). Es ist kein offizieller KGS-Client und gehört nicht zum KGS Go Server.',

	// Suche (routes/suche)
	'app.search.pageTitle': 'Suche – GoTV',
	'app.search.title': 'Suche',
	'app.search.userName': 'Benutzername',
	'app.search.found': 'Gefundene Spieler',

	// KGS login (LoginForm, KgsGate, OfflineAlert, kgsText.ts)
	'app.login.title': 'Bei KGS anmelden',
	'app.login.unreachable':
		'KGS ist nicht erreichbar. Versuche es noch einmal oder prüfe die Internetverbindung.',
	'app.login.password': 'Passwort',
	'app.login.savePassword': 'Passwort in diesem Browser speichern',
	'app.login.loggingIn': 'Anmeldung läuft …',
	'app.login.register': 'Bei KGS registrieren',
	'app.login.forgotPassword': 'Passwort vergessen',
	'app.gameWindow.title': 'Partie',
	'app.boards.title': 'Brettübersicht',
	'app.boards.open': 'Brettübersicht',
	'app.boards.openHint':
		'Mehrere Partien in einem eigenen Fenster – für den Mannschaftskampf oder Partien, die du verfolgen willst',
	'app.boards.add': 'Zur Brettübersicht',
	'app.boards.added':
		'Die Partie liegt jetzt in der Brettübersicht. Das Fenster ist schon offen – „Brettübersicht“ holt es nach vorn.',
	'app.boards.own': 'Deine Partie',
	'app.boards.ownHint': 'Klick: zurück in dein Partiefenster',
	'app.boards.showOwn': 'Eigene Partie zeigen',
	'app.boards.mode': 'Partien in die Brettübersicht holen',
	'app.boards.modeHint':
		'Solange der Haken gesetzt ist, kommt jede Partie, die du hier anklickst, in die Brettübersicht – ein Fenster mit bis zu sechs Brettern, z. B. für den Mannschaftskampf.',
	'app.boards.playingNow': 'Spielt gerade: {white} – {black} · Zug {move}',
	'app.boards.watch': 'Ansehen',
	'app.boards.full': 'Alle sechs Bretter sind belegt – entferne erst eines in der Brettübersicht.',
	'app.boards.fullOpened':
		'Die Brettübersicht ist voll (6 Bretter), deshalb ist die Partie in einem eigenen Fenster aufgegangen. Nimm in der Brettübersicht ein Brett mit × herunter oder entferne den Haken oben.',
	'app.boards.board': 'Brett {board}',
	'app.boards.move': 'Zug {move}',
	'app.boards.loading': 'Brett lädt …',
	'app.boards.gone':
		'Diese Partie ist nicht mehr da (ältere KGS-Sitzung). Nimm das Brett mit × herunter.',
	'app.boards.all': 'Alle Bretter',
	'app.boards.remove': 'Vom Brett nehmen',
	'app.boards.clear': 'Alle entfernen',
	'app.boards.askClose':
		'Kein Brett mehr – nur noch deine eigene Partie. Brettübersicht schließen? Deine Partie läuft in ihrem Fenster weiter.',
	'app.boards.close': 'Schließen',
	'app.boards.keepOpen': 'Offen lassen',
	'app.boards.empty':
		'Noch keine Bretter. Hol dir Partien über „Beobachten“ oder das Spielerprofil mit „Zur Brettübersicht“ hierher – zum Beispiel die Partien deiner Mannschaft.',
	'app.gameWindow.missing': 'Diese Partie gibt es nicht (mehr).',
	'app.gate.otherWindowTitle': 'KGS läuft in einem anderen GoTV-Fenster',
	'app.gate.otherWindowText':
		'GoTV ist schon in einem anderen Fenster oder Tab geöffnet, und nur eines davon kann mit KGS verbunden sein – sonst landen Züge und Nachrichten im falschen Fenster. Mach dort weiter oder schließe es: Dann übernimmt dieses Fenster von selbst. Live, Kalender, Kanäle und Nachspielen gehen hier ganz normal.',
	'app.gate.title': 'KGS nur in der Desktop-App',
	'app.gate.text':
		'KGS beantwortet Anfragen nur von seiner eigenen Webseite. Beobachten, Spielen und Chat auf KGS gibt es deshalb in der Desktop-App von GoTV. Übertragungen, Kalender, Kanäle und Nachspielen funktionieren hier ohne Anmeldung.',
	'app.downloads.title': 'GoTV-Desktop-App herunterladen',
	'app.downloads.intro':
		'Mit der Desktop-App gibt es zusätzlich KGS: beobachten, spielen, chatten, automatische Gegnerwahl. Kostenlos, ohne Konto bei uns.',
	'app.downloads.mobile':
		'Auf iPad und iPhone gibt es keine Desktop-App - nutze diese Web-Version (Teilen → „Zum Home-Bildschirm“).',
	'app.downloads.os.windows': 'Windows',
	'app.downloads.os.macos': 'macOS',
	'app.downloads.os.linux': 'Linux',
	'app.downloads.kind.exe': 'Installer (.exe)',
	'app.downloads.kind.msi': '.msi',
	'app.downloads.kind.dmg': 'Apple Silicon und Intel (.dmg)',
	'app.downloads.kind.appimage': 'AppImage',
	'app.downloads.kind.deb': '.deb (Debian, Ubuntu)',
	'app.downloads.unsigned':
		'Die Apps sind nicht signiert: Windows und macOS warnen beim ersten Start.',
	'app.downloads.help': 'So öffnest du sie',
	'app.downloads.allVersions': 'Alle Versionen',
	'app.offline.disconnected': 'Verbindung zu KGS getrennt',
	'app.offline.retrying': 'Neuer Verbindungsversuch läuft …',
	'app.offline.loginAgain': 'Bitte melde dich neu an.',
	'app.kgs.enterLogin': 'Bitte Benutzername und Passwort eingeben.',
	'app.kgs.noSuchUser': 'Anmeldung fehlgeschlagen: Diesen Benutzer gibt es bei KGS nicht.',
	'app.kgs.banned': 'Anmeldung fehlgeschlagen: Das Konto ist vorübergehend gesperrt.',
	'app.kgs.badPassword': 'Anmeldung fehlgeschlagen: Das Passwort stimmt nicht.',
	'app.kgs.userExists': 'Anmeldung fehlgeschlagen: Den Benutzer gibt es schon.',
	'app.kgs.loggedInElsewhere': 'Abgemeldet, weil das Konto anderswo angemeldet wurde',
	'app.kgs.sessionExpired': 'Die vorige Sitzung ist abgelaufen',

	// Dialogs (Modal, FeedbackModal, UnderConstructionModal)
	'app.modal.close': 'Schließen',
	'app.feedback.title': 'Feedback',
	'app.feedback.text':
		'Fehler gefunden oder einen Wunsch für GoTV? GoTV wird auf GitHub entwickelt. Dort findest du das Projekt und wie du Kontakt aufnimmst.',
	'app.feedback.kgsName': 'Nenne gern deinen KGS-Namen ({name}), wenn es um KGS geht.',
	'app.feedback.openGithub': 'GoTV auf GitHub öffnen',
	'app.underConstruction.title': 'Noch nicht verfügbar',
	'app.underConstruction.text': 'Diese Funktion gibt es in GoTV noch nicht.',
	'app.underConstruction.helpBefore': 'Mithelfen? GoTV wird auf',
	'app.underConstruction.helpAfter': 'entwickelt.',

	// Small parts (Spinner, UnseenBadge, UserName, Board, BoardNav, PlayerBar, WinCurve)
	'app.spinner.loading': 'Lädt …',
	'app.badge.unseen': '{count} neu',
	'app.user.bot': 'Bot',
	'app.user.selfish': 'spielt keine Partien gegen Unbekannte',
	'app.user.guest': 'Gast',
	'app.user.unknown': 'unbekannt',
	'app.board.label': 'Go-Brett',
	'app.boardNav.moves': 'Züge',
	'app.boardNav.first': 'Zum Anfang',
	'app.boardNav.back': 'Ein Zug zurück',
	'app.boardNav.choose': 'Zug wählen',
	'app.boardNav.valuetext': 'Zug {move} von {last}',
	'app.boardNav.forward': 'Ein Zug vor',
	'app.boardNav.current': 'Zum aktuellen Zug',
	'app.boardNav.last': 'Zum letzten Zug',
	'app.color.black': 'Schwarz',
	'app.color.white': 'Weiß',
	'app.playerBar.clock': 'Bedenkzeit',
	'app.winCurve.label': 'Gewinnchance Schwarz im Partieverlauf',
	'app.winCurve.labelNow': 'Gewinnchance Schwarz im Partieverlauf, jetzt {percent} Prozent',
	'app.winCurve.valuetext': 'Zug {move}, Schwarz {percent} Prozent',
	'app.winCurve.black': 'Schwarz {percent} %',
	'app.winCurve.white': 'Weiß {percent} %',

	// Kalender (routes/kalender, CalendarView, CalendarMonth)
	'app.calendar.pageTitle': 'Kalender – GoTV',
	'app.calendar.title': 'Kalender',
	'app.calendar.view': 'Ansicht',
	'app.calendar.month': 'Monat',
	'app.calendar.list': 'Liste',
	'app.calendar.regionDe': 'Deutschland',
	'app.calendar.regionIntl': 'International',
	'app.calendar.archive': 'Archiv · {region}',
	'app.calendar.loading': 'Kalender wird geladen …',
	'app.calendar.error': 'Kalender konnte nicht geladen werden (events.json nicht erreichbar).',
	'app.calendar.retry': 'Erneut versuchen',
	'app.calendar.empty': 'Keine Events im Kalender.',
	'app.calendar.prevMonth': 'Vorheriger Monat',
	'app.calendar.today': 'Heute',
	'app.calendar.nextMonth': 'Nächster Monat',
	'app.calendar.legend': 'Legende',
	'app.calendar.withStream': 'mit Stream',
	'app.calendar.withoutStream': 'ohne Stream',
	'app.calendar.gamesToReplay': 'Partien zum Nachspielen',
	'app.calendar.weekday.mon': 'Mo',
	'app.calendar.weekday.tue': 'Di',
	'app.calendar.weekday.wed': 'Mi',
	'app.calendar.weekday.thu': 'Do',
	'app.calendar.weekday.fri': 'Fr',
	'app.calendar.weekday.sat': 'Sa',
	'app.calendar.weekday.sun': 'So',
	'app.calendar.more': '+{count} weitere',
	'app.calendar.noTournaments': 'Keine Turniere an diesem Tag.',

	// Calendar card (CalendarEventCard)
	'app.calendarCard.boardsKgs': { one: '{count} KGS-Brett', other: '{count} KGS-Bretter' },
	'app.calendarCard.boardsOgs': { one: '{count} OGS-Brett', other: '{count} OGS-Bretter' },
	'app.calendarCard.boardsMixed': {
		one: '{count} Brett (KGS + OGS)',
		other: '{count} Bretter (KGS + OGS)'
	},
	'app.calendarCard.liveBoards': '{boards} · Live-Züge und Partiechat',
	'app.calendarCard.liveStreamBoards': 'Stream + {boards} · Live-Züge und Partiechat',
	'app.calendarCard.sgfAvailable': 'SGF-Brett zum Nachspielen verfügbar',
	'app.calendarCard.overReplay': 'Termin vorbei · Partien zum Nachspielen',
	'app.calendarCard.overNoBoard': 'Termin vorbei · kein Live-Brett verfügbar',
	'app.calendarCard.bothLinked': 'KGS-/OGS-Zuordnungen hinterlegt · derzeit kein Brett geladen',
	'app.calendarCard.ogsLinked': 'OGS-Zuordnung hinterlegt',
	'app.calendarCard.ogsLinkedWithStream':
		'OGS-Zuordnung hinterlegt · Brett lädt beim Öffnen des Streams',
	'app.calendarCard.ogsLinkedOnOpen': 'OGS-Zuordnung hinterlegt · Brett lädt beim Öffnen',
	'app.calendarCard.kgsLinked': 'KGS-Zuordnung hinterlegt',
	'app.calendarCard.kgsLinkedNone':
		'KGS-Zuordnung hinterlegt · derzeit kein passendes Brett online',
	'app.calendarCard.streamOnly': 'Nur Stream · kein Brett zugeordnet',
	'app.calendarCard.showWinner': 'Ergebnis anzeigen',
	'app.calendarCard.winner': 'Sieger: {winner}',
	'app.calendarCard.results': 'Ergebnisse',
	'app.calendarCard.replaySgf': 'SGF nachspielen',
	'app.update.about': 'Über GoTV',
	'app.update.version': 'GoTV Desktop, Version {version}',
	'app.update.check': 'Nach Updates suchen',
	'app.update.checking': 'Suche …',
	'app.update.upToDate': 'Du hast die neueste Version.',
	'app.update.error': 'GitHub ist gerade nicht erreichbar. Später noch einmal versuchen.',
	'app.update.available': 'Neue Version {version} ist da',
	'app.update.current': 'Du hast Version {version}.',
	'app.update.howTo':
		'Der Download öffnet sich im Browser – danach GoTV schließen und den Installer starten.',
	'app.update.download': 'Herunterladen: {kind}',
	'app.update.opened': 'Der Download wurde im Browser geöffnet.',
	'app.update.failed': 'Der Browser ließ sich nicht öffnen. Die Dateien liegen hier:',
	'app.update.later': 'Später',
	'app.update.script': 'GoTV Desktop für Linux (Skriptinstallation aus dem GoTV-Ordner).',
	'app.update.scriptAvailable': 'Neue Änderungen auf GitHub: {count}.',
	'app.update.scriptRun': 'Jetzt aktualisieren',
	'app.update.scriptRunning':
		'GoTV wird aktualisiert (holen, bauen, installieren) – das dauert 1 bis 3 Minuten. Du kannst so lange weiter spielen.',
	'app.update.scriptDone': 'Aktualisiert.',
	'app.update.scriptReload': 'Neu laden',
	'app.update.scriptRestarting':
		'Aktualisiert – der GoTV-Dienst startet neu, gleich lädt die Seite neu …',
	'app.update.scriptDirty':
		'Im GoTV-Ordner gibt es eigene Änderungen – bitte von Hand aktualisieren: „git pull“ und „sh desktop/install.sh“.',
	'app.update.scriptNoGit':
		'Der GoTV-Ordner ist kein Git-Klon oder folgt keinem Zweig auf GitHub – bitte von Hand aktualisieren.',
	'app.update.scriptPullFailed': 'Holen von GitHub („git pull“) ist fehlgeschlagen.',
	'app.update.scriptInstallFailed': 'Bauen oder Installieren ist fehlgeschlagen.',
	'app.update.scriptTimeout': 'Das Update hat zu lange gedauert und wurde abgebrochen.',
	'app.update.scriptServer':
		'Dieser GoTV-Dienst kann sich noch nicht selbst aktualisieren. Einmal von Hand im GoTV-Ordner: „git pull“ und „sh desktop/install.sh“, dann GoTV neu starten – ab dann geht es mit dem Knopf.',
	'app.update.scriptDetails': 'Details',
	'app.update.sources': 'Daten und Quellen',
	'app.update.sourcesText':
		'Termine, Partien und Videos in GoTV stammen von ihren Veranstaltern und Plattformen: KGS, OGS (online-go.com), European Go Federation, Deutscher Go-Bund, Speed Go Championship, YouTube und Twitch. GoTV zeigt sie an und verlinkt auf die Quellen; die Rechte bleiben bei ihnen.',
	'app.update.noAiTraining':
		'Das automatische Auslesen von GoTV und seiner Kalenderdatei für das Training von KI-Modellen (Text- und Data-Mining) ist nicht gestattet – Nutzungsvorbehalt nach § 44b UrhG und Art. 4 der EU-Richtlinie 2019/790.',
	'app.update.web': 'Web-Version – sie ist immer auf dem neuesten Stand.'
} satisfies Record<string, Message>;
