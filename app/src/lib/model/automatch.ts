// Automatic opponent selection (KGS automatch, "Automatische Gegnerwahl" in
// CGoban). Protocol (https://www.gokgs.com/json/upstream.html):
// AUTOMATCH_SET_PREFS saves the prefs, AUTOMATCH_CREATE starts the search
// with them, AUTOMATCH_CANCEL stops it; KGS answers with AUTOMATCH_PREFS and
// AUTOMATCH_STATUS {enabled}. New in GoTV - neither Shin KGS had it.
import type { AutomatchPrefs } from './types';

// CGoban's defaults: humans, ranked, fast, at most 2 ranks apart.
export const DEFAULT_AUTOMATCH_PREFS: AutomatchPrefs = {
	maxHandicap: 2,
	humanOk: true,
	robotOk: false,
	unrankedOk: false,
	rankedOk: true,
	freeOk: false,
	mediumOk: false,
	fastOk: true,
	blitzOk: false
} as AutomatchPrefs;

// The message with every field KGS documents (upstream.html), booleans as
// true/false: KGS sends its booleans only when true, and the prefs went back
// as they came - the false ones and, before KGS ever sent prefs, the rank
// were missing (review 28.11.2026; after DETAILS_CHANGE such a message ended
// the session). As the open client GoUniverse: the field is "estimatedRank"
// (the docs misspell it), and "?" - which KGS itself sends - is not taken
// by AUTOMATCH_CREATE, so it goes as "30k".
export function automatchMessage(
	type: 'AUTOMATCH_CREATE' | 'AUTOMATCH_SET_PREFS',
	prefs: Partial<AutomatchPrefs>,
	myRank?: string | null
): Record<string, unknown> {
	let rank = prefs.estimatedRank || myRank || '30k';
	if (type === 'AUTOMATCH_CREATE' && !/^\d+[kdp]$/.test(rank)) rank = '30k';
	const flag = (value: boolean | undefined) => value === true;
	return {
		type,
		maxHandicap: Math.min(
			MAX_HANDICAP_MAX,
			Math.max(MAX_HANDICAP_MIN, Number(prefs.maxHandicap) || 0)
		),
		estimatedRank: rank,
		freeOk: flag(prefs.freeOk),
		rankedOk: flag(prefs.rankedOk),
		robotOk: flag(prefs.robotOk),
		humanOk: flag(prefs.humanOk),
		unrankedOk: flag(prefs.unrankedOk),
		blitzOk: flag(prefs.blitzOk),
		fastOk: flag(prefs.fastOk),
		mediumOk: flag(prefs.mediumOk)
	};
}

// CGoban's limits for "Max. Rangunterschied".
export const MAX_HANDICAP_MIN = 0;
export const MAX_HANDICAP_MAX = 9;
