import type { settings as de } from '../de/settings.ts';
import type { Translation } from '../types.ts';

export const settings: Translation<typeof de> = {
	'settings.pageTitle': 'Settings – GoTV',
	'settings.title': 'Settings',
	'settings.language': 'Sprache / Language',
	'settings.languageHint': 'Applies at once and is remembered in this browser.',
	'settings.design': 'Design',
	'settings.designHint': 'Applies at once and is remembered in this browser.',
	'settings.navOrder': 'Menu order',
	'settings.navOrderHint':
		'What comes first at the top. While a broadcast is on, "Live" lights up - in the KGS order it then moves to the front.',
	'settings.navOrder.gotv.name': 'GoTV',
	'settings.navOrder.gotv.description': 'Broadcasts first, then KGS.',
	'settings.navOrder.kgs.name': 'KGS',
	'settings.navOrder.kgs.description':
		'Like a KGS client: Watch, Play, Chat, Search first. While a broadcast is on, Live comes first.',
	'settings.boardResize': 'KGS board size',
	'settings.boardResize.fit.name': 'Fit to window',
	'settings.boardResize.fit.description': 'The whole board stays visible as you resize it.',
	'settings.boardResize.scroll.name': 'Resize with scrolling',
	'settings.boardResize.scroll.description':
		'The board can grow taller than the window. Scroll at the side of the board.',
	'settings.myData': 'My data',
	'settings.design.modern.name': 'Modern',
	'settings.design.modern.description':
		'Light and calm, with the board and the stream at the centre.',
	'settings.design.modernDark.name': 'Modern dark',
	'settings.design.modernDark.description':
		'The modern design in dark – easy on the eyes in the evening and in cinema mode.',
	'settings.design.oldschool.name': 'Classic',
	'settings.design.oldschool.description':
		'Like classic Go programs: grey windows, a wooden board with shaded stones.'
};
