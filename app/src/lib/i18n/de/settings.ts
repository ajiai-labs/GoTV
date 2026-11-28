import type { Message } from '../types.ts';

// Einstellungen (src/routes/einstellungen) and the designs (ui/design.svelte.ts).
export const settings = {
	'settings.pageTitle': 'Einstellungen – GoTV',
	'settings.title': 'Einstellungen',
	'settings.language': 'Sprache / Language',
	'settings.languageHint': 'Gilt sofort und bleibt in diesem Browser gespeichert.',
	'settings.design': 'Design',
	'settings.tone': 'Farbton:',
	'settings.tone.paper': 'Warmes Papier',
	'settings.tone.yellow': 'Gelb',
	'settings.tone.red': 'Rot',
	'settings.tone.blue': 'Blau',
	'settings.tone.green': 'Grün (bisher)',
	'settings.designHint': 'Gilt sofort und bleibt in diesem Browser gespeichert.',
	'settings.navOrder': 'Menü-Anordnung',
	'settings.navOrderHint':
		'Was oben zuerst steht. Läuft eine Übertragung, leuchtet „Live“ – in der KGS-Anordnung rückt es dann nach vorn.',
	'settings.navOrder.gotv.name': 'GoTV',
	'settings.navOrder.gotv.description': 'Übertragungen zuerst, dann KGS.',
	'settings.navOrder.kgs.name': 'KGS',
	'settings.navOrder.kgs.description':
		'Wie ein KGS-Programm: erst Beobachten, Spielen, Chat, Suche. Läuft eine Übertragung, steht Live vorn.',
	'settings.myData': 'Meine Daten',
	'settings.design.modern.name': 'Modern',
	'settings.design.modern.description': 'Hell und ruhig, Brett und Stream stehen im Mittelpunkt.',
	'settings.design.modernDark.name': 'Modern dunkel',
	'settings.design.modernDark.description':
		'Das moderne Design in dunkel – angenehm am Abend und im Kinomodus.',
	'settings.design.oldschool.name': 'Classic',
	'settings.design.oldschool.description':
		'Wie klassische Go-Programme: graue Fenster, Holzbrett mit plastischen Steinen.',
	'settings.sounds': 'Töne beim Spielen',
	'settings.soundsHint':
		'Für deine eigenen KGS-Partien – damit du hörst, wenn es weitergeht, auch wenn du gerade nicht vor dem Bildschirm sitzt.',
	'settings.sounds.stones.name': 'Steinklick',
	'settings.sounds.stones.description': 'Bei jedem Zug, auch dem deines Gegners.',
	'settings.sounds.gameStart.name': 'Partiebeginn',
	'settings.sounds.gameStart.description':
		'Ein deutlicher Klang, sobald deine Partie beginnt: automatische Gegnerwahl, angenommene Herausforderung, fortgesetzte Partie.',
	'settings.sounds.countdown.name': 'Zeit läuft ab',
	'settings.sounds.countdown.description':
		'Ein Piepton für jede der letzten 10 Sekunden auf deiner Uhr, die letzten 3 höher.',
	'settings.sounds.messages.name': 'Chatnachricht',
	'settings.sounds.messages.description':
		'Wenn dir jemand schreibt: private Nachricht oder Chat in deiner laufenden Partie.',
	'settings.sounds.sample': 'Anhören',
	'settings.gameWindows': 'Partiefenster',
	'settings.gameWindows.name': 'Partien in eigenem Fenster öffnen',
	'settings.gameWindows.description':
		'Wie in CGoban: jede Partie, die du anklickst, bekommt ein eigenes Fenster; ist es schon offen, kommt es nach vorn. Das Hauptfenster behält Listen und Chats.'
} satisfies Record<string, Message>;
