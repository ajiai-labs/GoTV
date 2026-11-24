// German texts for game data. The logic taken over from the old app
// (model/game/display.ts, tree.ts) formats results, game types, rulesets and
// chat actions in English; the new interface shows them in German.
import { formatGameScore } from '#lib/model/game/display.ts';
import type { GameRuleSet, GameScore, GameType } from '#lib/model/types.ts';

const RESULT_WORDS: Record<string, string> = {
	Resign: 'Aufgabe',
	Time: 'Zeit',
	Forfeit: 'kampflos',
	Unknown: 'Unbekannt',
	Unfinished: 'Nicht beendet',
	'No Result': 'Kein Ergebnis'
};

// "B+Resign" -> "S+Aufgabe", "W+6.5" -> "W+6.5", "Unknown" -> "Unbekannt".
function translateScoreText(text: string): string {
	const match = /^([BW])\+(.*)$/.exec(text);
	if (!match) return RESULT_WORDS[text] ?? text;
	const color = match[1] === 'B' ? 'S' : 'W';
	return color + '+' + (RESULT_WORDS[match[2]] ?? match[2]);
}

// A game result in German (S = Schwarz, W = Weiß).
export function formatScoreDe(score: GameScore): string {
	return translateScoreText(String(formatGameScore(score)));
}

const GAME_TYPE_DE: Record<GameType, string> = {
	challenge: 'Herausforderung',
	demonstration: 'Demonstration',
	review: 'Besprechung',
	rengo_review: 'Rengo-Besprechung',
	teaching: 'Lehrpartie',
	simul: 'Simultan',
	rengo: 'Rengo',
	free: 'Frei',
	ranked: 'Gewertet',
	tournament: 'Turnier'
};

export function formatGameTypeDe(type: GameType): string {
	return GAME_TYPE_DE[type] ?? type;
}

const RULESET_DE: Record<GameRuleSet, string> = {
	japanese: 'Japanisch',
	chinese: 'Chinesisch',
	aga: 'AGA',
	new_zealand: 'Neuseeländisch'
};

export function formatRulesetDe(ruleset: GameRuleSet): string {
	return RULESET_DE[ruleset] ?? ruleset;
}

// The actions of a game chat section ("Black passed", "Game Over: B+Resign").
export function formatChatActionDe(action: string): string {
	if (action === 'Black passed') return 'Schwarz passt';
	if (action === 'White passed') return 'Weiß passt';
	const over = /^Game Over: (.*)$/.exec(action);
	if (over) return 'Partie beendet: ' + translateScoreText(over[1]);
	return action;
}
