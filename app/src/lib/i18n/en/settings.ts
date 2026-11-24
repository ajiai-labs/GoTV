import type { settings as de } from '../de/settings.ts';
import type { Translation } from '../types.ts';

export const settings: Translation<typeof de> = {
	'settings.pageTitle': 'Settings – GoTV',
	'settings.title': 'Settings',
	'settings.language': 'Sprache / Language',
	'settings.languageHint': 'Applies at once and is remembered in this browser.',
	'settings.design': 'Design',
	'settings.designHint': 'Applies at once and is remembered in this browser.',
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
