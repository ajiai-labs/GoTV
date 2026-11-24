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

// The prefs go back exactly as KGS sent them (field names included - the
// protocol docs spell the rank field "estiamtedRank"), only the type changes.
export function automatchMessage(
	type: 'AUTOMATCH_CREATE' | 'AUTOMATCH_SET_PREFS',
	prefs: AutomatchPrefs
): Record<string, unknown> {
	const rest: Record<string, unknown> = { ...prefs };
	delete rest.type;
	return { ...rest, type };
}

// CGoban's limits for "Max. Rangunterschied".
export const MAX_HANDICAP_MIN = 0;
export const MAX_HANDICAP_MAX = 9;
