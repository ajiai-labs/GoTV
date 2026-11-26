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
	'settings.myData': 'My data',
	'settings.design.modern.name': 'Modern',
	'settings.design.modern.description':
		'Light and calm, with the board and the stream at the centre.',
	'settings.design.modernDark.name': 'Modern dark',
	'settings.design.modernDark.description':
		'The modern design in dark – easy on the eyes in the evening and in cinema mode.',
	'settings.design.oldschool.name': 'Classic',
	'settings.design.oldschool.description':
		'Like classic Go programs: grey windows, a wooden board with shaded stones.',
	'settings.sounds': 'Sounds while playing',
	'settings.soundsHint':
		'For your own KGS games – so you hear when it goes on, even away from the screen.',
	'settings.sounds.stones.name': 'Stone click',
	'settings.sounds.stones.description': 'On every move, your opponent’s too.',
	'settings.sounds.gameStart.name': 'Game start',
	'settings.sounds.gameStart.description':
		'A clear chime as soon as your game starts: automatch, accepted challenge, resumed game.',
	'settings.sounds.countdown.name': 'Time running out',
	'settings.sounds.countdown.description':
		'A beep for each of the last 10 seconds on your clock, the last 3 higher.',
	'settings.sounds.messages.name': 'Chat message',
	'settings.sounds.messages.description':
		'When someone writes to you: a private message or the chat of your running game.',
	'settings.sounds.sample': 'Listen'
};
