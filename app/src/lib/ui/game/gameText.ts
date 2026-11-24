// Texts for game data in the interface language. The logic taken over from
// the old app (model/game/display.ts, tree.ts) formats results, game types,
// rulesets and chat actions in English; German shows them in German, English
// keeps the original texts (the keys' English values are exactly those).
import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
import { formatGameScore } from '#lib/model/game/display.ts';
import type { GameRuleSet, GameScore, GameType } from '#lib/model/types.ts';

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
