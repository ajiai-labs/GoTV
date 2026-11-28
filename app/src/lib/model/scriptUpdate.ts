// "Nach Updates suchen" of the script installation (desktop/install.sh):
// the local server (desktop/script_update.py) fetches from GitHub, pulls and
// installs - the page only asks it and shows the state (28.11.2026).
export const SCRIPT_UPDATE_PATH = '/desktop/script-update';

export type ScriptUpdateError =
	| 'noGit'
	| 'noUpstream'
	| 'fetchFailed'
	| 'dirty'
	| 'upToDate'
	| 'pullFailed'
	| 'installFailed'
	| 'timeout'
	| 'server';

export type ScriptUpdateStatus = {
	state: 'idle' | 'running' | 'done' | 'failed';
	error: ScriptUpdateError | null;
	// New commits on GitHub; null while unknown.
	behind: number | null;
	// Own changes in the GoTV folder: no update from the page.
	dirty: boolean;
	// The server or launcher changed: close and reopen GoTV.
	restart: boolean;
	log: Array<string>;
};

const STATES = new Set(['idle', 'running', 'done', 'failed']);

export function parseScriptUpdateStatus(data: unknown): ScriptUpdateStatus | null {
	if (!data || typeof data !== 'object') return null;
	const raw = data as Record<string, unknown>;
	if (typeof raw.state !== 'string' || !STATES.has(raw.state)) return null;
	return {
		state: raw.state as ScriptUpdateStatus['state'],
		error: typeof raw.error === 'string' ? (raw.error as ScriptUpdateError) : null,
		behind: typeof raw.behind === 'number' ? raw.behind : null,
		dirty: raw.dirty === true,
		restart: raw.restart === true,
		log: Array.isArray(raw.log) ? raw.log.filter((line) => typeof line === 'string') : []
	};
}

// GET the state, or POST "check" / "run" (with the header the server wants
// from the page itself).
export async function requestScriptUpdate(
	action: 'status' | 'check' | 'run',
	fetchFn: typeof fetch = fetch
): Promise<ScriptUpdateStatus> {
	const url = action === 'status' ? SCRIPT_UPDATE_PATH : `${SCRIPT_UPDATE_PATH}/${action}`;
	const init: RequestInit =
		action === 'status'
			? { cache: 'no-store' }
			: { method: 'POST', headers: { 'X-GoTV-Update': '1' }, cache: 'no-store' };
	const response = await fetchFn(url, init);
	const status = response.ok ? parseScriptUpdateStatus(await response.json()) : null;
	if (!status) throw new Error('script update: unexpected answer');
	return status;
}
