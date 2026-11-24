import type { Message } from '../types.ts';

// Einstellungen (src/routes/einstellungen) and the designs (ui/design.svelte.ts).
export const settings = {
	'settings.pageTitle': 'Einstellungen – GoTV',
	'settings.title': 'Einstellungen',
	'settings.language': 'Sprache / Language',
	'settings.languageHint': 'Gilt sofort und bleibt in diesem Browser gespeichert.',
	'settings.design': 'Design',
	'settings.designHint': 'Gilt sofort und bleibt in diesem Browser gespeichert.',
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
