// Texts for game data in the interface language. The logic taken over from
// the old app (model/game/display.ts, tree.ts) formats results, game types,
// rulesets and chat actions in English; German shows them in German, English
// keeps the original texts (the keys' English values are exactly those).
import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
import { formatGameScore } from '#lib/model/game/display.ts';
import type { GameChannel, GameRules, GameRuleSet, GameScore, GameType } from '#lib/model/types.ts';

const RESULT_WORDS: Record<string, MessageKey> = {
	Resign: 'game.result.resign',
	Time: 'game.result.time',
	Forfeit: 'game.result.forfeit',
	Unknown: 'game.result.unknown',
	Unfinished: 'game.result.unfinished',
	'No Result': 'game.result.noResult'
};

function translateWord(word: string): string {
	const key = RESULT_WORDS[word];
	return key ? t(key) : word;
}

// "B+Resign" -> "S+Aufgabe", "W+6.5" -> "W+6.5", "Unknown" -> "Unbekannt".
function translateScoreText(text: string): string {
	const match = /^([BW])\+(.*)$/.exec(text);
	if (!match) return translateWord(text);
	const color = t(match[1] === 'B' ? 'game.result.black' : 'game.result.white');
	return color + '+' + translateWord(match[2]);
}

// A game result (German: S = Schwarz, W = Weiß; English: B+Resign as before).
export function formatScoreDe(score: GameScore): string {
	return translateScoreText(String(formatGameScore(score)));
}

const GAME_TYPE_KEYS: Record<GameType, MessageKey> = {
	challenge: 'game.type.challenge',
	demonstration: 'game.type.demonstration',
	review: 'game.type.review',
	rengo_review: 'game.type.rengoReview',
	teaching: 'game.type.teaching',
	simul: 'game.type.simul',
	rengo: 'game.type.rengo',
	free: 'game.type.free',
	ranked: 'game.type.ranked',
	tournament: 'game.type.tournament'
};

export function formatGameTypeDe(type: GameType): string {
	const key = GAME_TYPE_KEYS[type];
	return key ? t(key) : type;
}

const RULESET_KEYS: Record<GameRuleSet, MessageKey> = {
	japanese: 'game.ruleset.japanese',
	chinese: 'game.ruleset.chinese',
	aga: 'game.ruleset.aga',
	new_zealand: 'game.ruleset.newZealand'
};

export function formatRulesetDe(ruleset: GameRuleSet): string {
	const key = RULESET_KEYS[ruleset];
	return key ? t(key) : ruleset;
}

// The actions of a game chat section ("Black passed", "Game Over: B+Resign").
export function formatChatActionDe(action: string): string {
	if (action === 'Black passed') return t('game.action.blackPassed');
	if (action === 'White passed') return t('game.action.whitePassed');
	const over = /^Game Over: (.*)$/.exec(action);
	if (over) return t('game.action.gameOver', { result: translateScoreText(over[1]) });
	return action;
}

// A duration as people say it: "30 Sek.", "10 Min.", "1:30 Min.", "1 Std."
export function formatDurationDe(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	if (total < 60) return t('game.time.seconds', { n: total });
	if (total % 3600 === 0) return t('game.time.hours', { n: total / 3600 });
	if (total % 60 === 0) return t('game.time.minutes', { n: total / 60 });
	const secs = total % 60;
	return t('game.time.minutesSeconds', {
		m: Math.floor(total / 60),
		s: (secs < 10 ? '0' : '') + secs
	});
}

// The time system in words (wish of the user, 28.11.2026, after the
// mockups): "30 Min. + 5×30 Sek." instead of "30:00 + 5×0:30".
export function formatTimeSystemDe(rules: GameRules): string {
	const main = rules.mainTime || 0;
	const mainText = main > 0 ? formatDurationDe(main) : '';
	const join = (extra: string) => (mainText ? `${mainText} + ${extra}` : extra);
	switch (rules.timeSystem) {
		case 'none':
			return t('game.time.none');
		case 'absolute':
			return `${formatDurationDe(main)} ${t('game.time.absolute')}`;
		case 'byo_yomi':
			return join(`${rules.byoYomiPeriods || 0}×${formatDurationDe(rules.byoYomiTime || 0)}`);
		case 'canadian':
			return join(
				t('game.time.canadian', {
					stones: rules.byoYomiStones || 0,
					time: formatDurationDe(rules.byoYomiTime || 0)
				})
			);
		default:
			return '';
	}
}

// Why a game cannot be watched, in the interface language - or null. KGS
// answers a join with PRIVATE_KEEP_OUT / CHANNEL_SUBSCRIBERS_ONLY
// (game.accessDenied); a private game is known from the game list before
// that (28.11.2026: the board overview said "wird geladen" for ever).
export function accessNoticeDe(game: GameChannel): string | null {
	if (game.accessDenied === 'KGS Plus Subscribers Only') return t('game.access.subscribers');
	if (game.accessDenied) return t('game.access.private');
	if (game.private && !game.tree) return t('game.access.private');
	return null;
}
