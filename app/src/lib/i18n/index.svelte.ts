// The interface language: German (de.ts, the approved wording) or English
// (en.ts). The choice lives in this browser (gotv.language, carried along in
// "Meine Daten" backups like every gotv.* setting); without one, the
// browser's language decides. Switching applies at once: t() reads the
// reactive state, so every text using it updates.
import { de, type MessageKey } from './de.ts';
import { en } from './en.ts';
import type { Message } from './types.ts';

export type { MessageKey } from './de.ts';

export type Language = 'de' | 'en';

// The names stay in their own language, so everyone finds theirs.
export const LANGUAGES: Array<{ id: Language; name: string }> = [
	{ id: 'de', name: 'Deutsch' },
	{ id: 'en', name: 'English' }
];

const STORAGE_KEY = 'gotv.language';

const LOCALES: Record<Language, string> = { de: 'de-DE', en: 'en-GB' };

const DICTIONARIES: Record<Language, Record<MessageKey, Message>> = { de, en };

// "de", "de-AT", "de-CH" -> German; everything else English.
export function languageFromBrowser(browserLanguage: string | null | undefined): Language {
	return browserLanguage && browserLanguage.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function loadLanguage(): Language {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'de' || saved === 'en') return saved;
	} catch {
		// storage disabled: the browser's language
	}
	return languageFromBrowser(typeof navigator === 'undefined' ? null : navigator.language);
}

class LanguageState {
	current: Language = $state(typeof window === 'undefined' ? 'de' : loadLanguage());

	set(language: Language) {
		this.current = language;
		document.documentElement.lang = language;
		try {
			localStorage.setItem(STORAGE_KEY, language);
		} catch {
			// not remembered without storage
		}
	}
}

export const language = new LanguageState();

if (typeof document !== 'undefined') document.documentElement.lang = language.current;

export type Params = Record<string, string | number>;

// Fills "{name}" placeholders from params; a plural text picks its form by
// params.count ("one" for 1, else "other" - the same rule in German and English).
export function formatMessage(message: Message, params?: Params): string {
	const text =
		typeof message === 'string'
			? message
			: Number(params?.count) === 1
				? message.one
				: message.other;
	if (!params) return text;
	return text.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in params ? String(params[name]) : match
	);
}

// The text for `key` in the current language.
export function t(key: MessageKey, params?: Params): string {
	// An unknown key (only possible past the type check) shows itself.
	const message: Message | undefined = DICTIONARIES[language.current][key] ?? de[key];
	return formatMessage(message ?? key, params);
}

// Locale for dates, times and numbers: "de-DE" or "en-GB".
export function locale(): string {
	return LOCALES[language.current];
}
