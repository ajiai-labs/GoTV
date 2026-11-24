import type { Message } from '../types.ts';

// Live broadcasts, channels and "Mein GoTV" (src/lib/ui/tv, model/tvChannels.ts,
// model/OgsTvSource.ts).
export const tv = {
	// Shared
	'tv.cancel': 'Abbrechen',
	'tv.onAirPlanned': 'läuft gerade (geplant)',

	// BroadcastCard: status line of the boards (list metadata)
	'tv.status.oneRunning': 'Partie läuft',
	'tv.status.onePaused': 'Partie pausiert',
	'tv.status.oneAdjourned': 'Partie unterbrochen',
	'tv.status.oneOver': 'Partie beendet',
	'tv.status.running': { one: '{count} Partie läuft', other: '{count} Partien laufen' },
	'tv.status.paused': { one: '{count} Partie pausiert', other: '{count} Partien pausiert' },
	'tv.status.adjourned': {
		one: '{count} Partie unterbrochen',
		other: '{count} Partien unterbrochen'
	},
	'tv.status.over': { one: '{count} Partie beendet', other: '{count} Partien beendet' },
	'tv.status.move': 'Zug {move}',

	// BroadcastCard: title above the boards
	'tv.broadcast.recordingTitle': 'Finalpartie zum Nachspielen · Aufzeichnung',
	'tv.broadcast.boardsKgsOgs': 'Bretter der Übertragung (KGS + OGS)',
	'tv.broadcast.boardsOn': { one: 'Brett auf {source}', other: '{count} Bretter auf {source}' },
	'tv.broadcast.ogsOnStreamOpen': 'OGS-Brett beim Öffnen des Streams verfügbar',
	'tv.broadcast.ogsAvailable': 'OGS-Brett verfügbar',
	'tv.broadcast.ogsLoading': 'OGS-Brett wird geladen …',
	'tv.broadcast.ogsAppears': 'OGS-Brett erscheint, sobald die Partie läuft',
	'tv.broadcast.noKgsStreamOnly': 'Kein KGS-Brett – nur Stream',
	'tv.broadcast.noKgsBoard': 'Derzeit kein passendes KGS-Brett online',
	'tv.broadcast.boardOnly': 'Nur Brett',
	'tv.broadcast.showVideo': 'Video zuschalten',
	'tv.broadcast.close': 'Übertragung schließen',
	'tv.broadcast.openBoard': 'Brett öffnen',
	'tv.broadcast.openBoards': 'Bretter öffnen',
	'tv.broadcast.ogsFailed': 'OGS-Brett konnte nicht geladen werden: {error}',
	'tv.broadcast.recordingHint': 'Das Brett erscheint nach „Stream laden“ neben dem Video.',

	// BroadcastCard: how fresh the OGS board is
	'tv.ogsStatus.staleSince': 'Verbindung zu OGS unterbrochen – letzter Stand von {time} ({error})',
	'tv.ogsStatus.stale': 'Verbindung zu OGS unterbrochen ({error})',
	'tv.ogsStatus.over':
		'Partie beendet – eine weitere Partie derselben Spieler erscheint automatisch',
	'tv.ogsStatus.liveDelayed': 'Live verbunden – Anzeige um {seconds} s verzögert',
	'tv.ogsStatus.live': 'Live verbunden – Züge erscheinen sofort',
	'tv.ogsStatus.polling': 'Brett wird alle paar Sekunden abgefragt',

	// BroadcastCard: board delay
	'tv.delay.label': 'Brett-Verzögerung',
	'tv.delay.off': 'aus',
	'tv.delay.earlier': 'Brett {seconds} Sekunden früher',
	'tv.delay.later': 'Brett {seconds} Sekunden später',

	// BroadcastCard: assigning an OGS game link
	'tv.link.assign': 'OGS-Partielink zuordnen',
	'tv.link.remove': 'Zuordnung entfernen',
	'tv.link.inputLabel': 'OGS-Partielink',
	'tv.link.submit': 'Zuordnen',
	'tv.link.invalid': 'Das ist kein OGS-Partielink. Erwartet: https://online-go.com/game/…',

	// BroadcastCard: divider and Kinomodus
	'tv.split.resize': 'Größe von Video und Brett ändern',
	'tv.split.valueText': 'Video {percent} Prozent',
	'tv.split.label': 'Aufteilung zwischen Stream und Brett',
	'tv.split.stream': 'Stream',
	'tv.split.board': 'Brett',
	'tv.cinema.enter': 'Kinomodus',
	'tv.cinema.exit': 'Kinomodus beenden (Esc)',
	'tv.cinema.showChat': 'Chat einblenden',
	'tv.cinema.hideChat': 'Chat ausblenden',

	// CinemaExample
	'tv.example.title': 'GoTV ausprobieren',
	'tv.example.subtitle': 'Beispiel · Aufzeichnung, keine Live-Partie',
	'tv.example.eventName': 'EM-Finale 2026 · Andrii Kravets gegen Ali Jabarin',
	'tv.example.eventNotes':
		'Der EGF-Kanal zeigt sein aktuelles Programm oder das Offlinebild. Das Nachspielbrett zeigt die historische Finalpartie und läuft unabhängig vom Video.',
	'tv.example.sourceBefore': 'Partie aus dem',
	'tv.example.sourceLink': 'offiziellen EGF-Archiv',

	// StreamEmbed
	'tv.stream.noVideo': 'Für dieses Turnier ist kein Videostream hinterlegt.',
	'tv.stream.cannotEmbedOn': 'Dieser Stream kann nicht direkt eingebettet werden ({platform}).',
	'tv.stream.cannotEmbed': 'Dieser Stream kann nicht direkt eingebettet werden.',
	'tv.stream.openTournamentPage': 'Turnierseite öffnen',
	'tv.stream.openExternally': 'Extern öffnen',
	'tv.stream.placeholder':
		'Stream wird über den offiziellen {platform}-Player eingebettet. Erst nach Klick wird eine Verbindung zu {platform} aufgebaut.',
	'tv.stream.channelHint':
		'Sendet der Kanal gerade nicht live, zeigt der Player „Gerade keine Übertragung“.',
	'tv.stream.load': 'Stream laden',

	// StreamChat
	'tv.streamChat.show': '{platform}-Chat anzeigen',
	'tv.streamChat.hide': '{platform}-Chat ausblenden',
	'tv.streamChat.hint': 'lädt den Chat von {platform}; schreiben nur mit {platform}-Anmeldung',
	'tv.streamChat.frameTitle': 'Chat: {title}',

	// TvSourceBadge
	'tv.source.ogs': 'Brett von online-go.com (OGS)',
	'tv.source.kgs': 'Brett vom KGS Go Server',

	// TvGamePanel
	'tv.panel.over': 'Partie beendet',
	'tv.panel.overWithScore': 'Partie beendet: {score}',
	'tv.panel.loading': 'Brett wird von {source} geladen …',
	'tv.panel.tabs': 'Partie',
	'tv.panel.chat': 'Chat',
	'tv.panel.info': 'Info',
	'tv.panel.observerCount': { one: '{count} Beobachter', other: '{count} Beobachter' },
	'tv.panel.gameInfo': 'Partieinfo',
	'tv.panel.observers': 'Beobachter',
	'tv.panel.gameChat': '{source}-Partiechat',
	'tv.panel.noMessages': 'Noch keine Chatnachrichten.',
	'tv.panel.chatLoading': 'Chat wird geladen …',

	// BoardPreviewGrid
	'tv.preview.boardAfterClick': 'Brett nach Klick',
	'tv.preview.over': 'beendet',
	'tv.preview.move': 'Zug {move}',
	'tv.preview.running': 'läuft',

	// OfflineNotice
	'tv.offline':
		'Offline · Nachspielen und KataGo gehen weiter, auch schon geöffnete Turnierpartien. Streams, Live-Bretter und neue Kalenderdaten brauchen Internet.',

	// FavoriteStar
	'tv.favorite.remove': '{name} aus Mein GoTV entfernen',
	'tv.favorite.add': '{name} zu Mein GoTV hinzufügen',

	// MyGoTv
	'tv.my.title': 'Mein GoTV',
	'tv.my.blocked': 'Erinnerungen sind im Browser blockiert',
	'tv.my.remind': '10 Min. vorher erinnern (solange GoTV offen ist)',
	'tv.my.hint':
		'Markiere Kanäle und Turniere mit ☆ – sie erscheinen dann hier mit ihrem nächsten Termin.',
	'tv.my.toChannels': 'Zu den Kanälen',
	'tv.my.kindChannel': 'Kanal',
	'tv.my.kindEvent': 'Turnier',
	'tv.my.now': 'läuft gerade',
	'tv.my.nextPlanned': 'nächste Sendung {when} (geplant)',
	'tv.my.noTime': 'keine feste Sendezeit',
	'tv.my.today': 'heute {time} Uhr',
	'tv.my.dayTime': '{day} {time} Uhr',

	// reminders.ts (browser notification)
	'tv.reminder.planned': 'Feste Sendezeit {time} Uhr (geplant)',
	'tv.reminder.starts': 'Beginnt um {time} Uhr',

	// ChannelsView
	'tv.channels.favorites': '★ Favoriten',
	'tv.channels.players': 'Spieler',
	'tv.channels.organizations': 'Verbände und Turniere',
	'tv.channels.loading': 'Kanäle werden geladen …',
	'tv.channels.error': 'Kanäle konnten nicht geladen werden (events.json nicht erreichbar).',
	'tv.channels.retry': 'Erneut versuchen',
	'tv.channels.empty': 'Keine Kanäle eingetragen.',

	// ChannelCard
	'tv.channel.schedule': 'Feste Sendezeit: {schedule} (deutsche Zeit)',
	'tv.channel.openOn': 'Auf {platform} öffnen (mit Chat)',
	'tv.channel.youtubeHint': 'Chat, Like und Abo gibt es direkt auf YouTube.',

	// ChannelWeek
	'tv.week.title': 'Wochenplan · feste Sendezeiten (deutsche Zeit, geplant)',
	'tv.week.today': '{day} (heute)',
	'tv.week.running': '(läuft gerade)',
	'tv.weekday.1': 'Montag',
	'tv.weekday.2': 'Dienstag',
	'tv.weekday.3': 'Mittwoch',
	'tv.weekday.4': 'Donnerstag',
	'tv.weekday.5': 'Freitag',
	'tv.weekday.6': 'Samstag',
	'tv.weekday.7': 'Sonntag',

	// model/tvChannels.ts: week plan and fixed air times ("sonntags 10:30 Uhr")
	'tv.weekdayShort.1': 'Mo',
	'tv.weekdayShort.2': 'Di',
	'tv.weekdayShort.3': 'Mi',
	'tv.weekdayShort.4': 'Do',
	'tv.weekdayShort.5': 'Fr',
	'tv.weekdayShort.6': 'Sa',
	'tv.weekdayShort.7': 'So',
	'tv.weekdays.1': 'montags',
	'tv.weekdays.2': 'dienstags',
	'tv.weekdays.3': 'mittwochs',
	'tv.weekdays.4': 'donnerstags',
	'tv.weekdays.5': 'freitags',
	'tv.weekdays.6': 'samstags',
	'tv.weekdays.7': 'sonntags',
	'tv.schedule.slot': '{weekdays} {time} Uhr',

	// model/OgsTvSource.ts: errors shown at the OGS board
	'tv.ogs.playerNotFound': 'OGS-Spieler nicht gefunden: {name}',
	'tv.ogs.unreachable': 'OGS nicht erreichbar',
	'tv.ogs.boardUnreachable': 'OGS-Brett nicht erreichbar'
} satisfies Record<string, Message>;
