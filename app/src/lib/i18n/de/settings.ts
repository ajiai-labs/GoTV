import type { Message } from '../types.ts';

// Einstellungen (src/routes/einstellungen) and the designs (ui/design.svelte.ts).
export const settings = {
	'settings.pageTitle': 'Einstellungen – GoTV',
	'settings.title': 'Einstellungen',
	'settings.language': 'Sprache / Language',
	'settings.languageHint': 'Gilt sofort und bleibt in diesem Browser gespeichert.',
	'settings.design': 'Design',
	'settings.designHint': 'Gilt sofort und bleibt in diesem Browser gespeichert.',
	'settings.navOrder': 'Menü-Anordnung',
	'settings.navOrderHint':
		'Was oben zuerst steht. Läuft eine Übertragung, leuchtet „Live“ – in der KGS-Anordnung rückt es dann nach vorn.',
	'settings.navOrder.gotv.name': 'GoTV',
	'settings.navOrder.gotv.description': 'Übertragungen zuerst, dann KGS.',
	'settings.navOrder.kgs.name': 'KGS',
	'settings.navOrder.kgs.description':
		'Wie ein KGS-Programm: erst Beobachten, Spielen, Chat, Suche. Läuft eine Übertragung, steht Live vorn.',
	'settings.boardResize': 'KGS-Brettgröße',
	'settings.boardResize.fit.name': 'Ans Fenster anpassen',
	'settings.boardResize.fit.description': 'Das ganze Brett bleibt sichtbar, auch beim Vergrößern.',
	'settings.boardResize.scroll.name': 'Mit Scrollen vergrößern',
	'settings.boardResize.scroll.description':
		'Das Brett kann höher als das Fenster werden. Seitlich am Brett kannst du scrollen.',
	'settings.myData': 'Meine Daten',
	'settings.design.modern.name': 'Modern',
	'settings.design.modern.description': 'Hell und ruhig, Brett und Stream stehen im Mittelpunkt.',
	'settings.design.modernDark.name': 'Modern dunkel',
	'settings.design.modernDark.description':
		'Das moderne Design in dunkel – angenehm am Abend und im Kinomodus.',
	'settings.design.oldschool.name': 'Classic',
	'settings.design.oldschool.description':
		'Wie klassische Go-Programme: graue Fenster, Holzbrett mit plastischen Steinen.'
} satisfies Record<string, Message>;
