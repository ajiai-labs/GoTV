// "Link kopieren" in Nachspielen: a link to the public web version that opens
// the same game at the same move (/nachspielen?sgf=<address>&zug=<move>).
// Only games loaded from an address can be shared; files, pasted SGF and KGS
// games have no address anyone else could open.
import { PUBLIC_BASE_URL } from '../publicUrl';

// The longest game GoTV opens has far fewer moves; longer numbers are typos.
const MAX_MOVE_DIGITS = 5;

// The SGF address as anyone can open it: http(s) addresses stay, bundled
// files ("/tv/em-finale-2026.sgf", also with this app's base path in front)
// get the public base. Anything else (blob:, data:, relative) gives null.
export function getPublicSgfUrl(url: string, basePath = ''): string | null {
	const trimmed = url.trim();
	if (trimmed.startsWith('//')) return getPublicSgfUrl('https:' + trimmed);
	if (trimmed.startsWith('/')) {
		const path =
			basePath && trimmed.startsWith(basePath + '/') ? trimmed.slice(basePath.length) : trimmed;
		return PUBLIC_BASE_URL + path;
	}
	try {
		const parsed = new URL(trimmed);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
	} catch {
		return null; // not an absolute address
	}
}

// The link to share, or null when the address cannot be shared. Move 0 (the
// empty board) needs no "zug".
export function getReplayShareLink(sgfUrl: string, move: number, basePath = ''): string | null {
	const sgf = getPublicSgfUrl(sgfUrl, basePath);
	if (!sgf) return null;
	const link = PUBLIC_BASE_URL + '/nachspielen?sgf=' + encodeURIComponent(sgf);
	return Number.isInteger(move) && move > 0 ? link + '&zug=' + String(move) : link;
}

// "zug" from the address: a move number (0 or more), else null (ignored).
export function parseMoveParam(value: string | null | undefined): number | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return new RegExp('^\\d{1,' + String(MAX_MOVE_DIGITS) + '}$').test(trimmed)
		? Number(trimmed)
		: null;
}
