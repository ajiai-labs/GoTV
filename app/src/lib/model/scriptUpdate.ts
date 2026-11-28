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

// A GoTV version as "git describe" against the release tags desktop-v*
// (desktop-v0.4.1-40-g404ad61: 40 commits after release 0.4.1), with commit
// and date - the installed one and the one on GitHub.
export type ScriptVersion = {
	describe: string | null;
	commit: string;
	date: string; // ISO
};

export type ScriptUpdatePhase = 'pull' | 'build' | 'install';

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
	current: ScriptVersion | null;
	target: ScriptVersion | null;
	// The step while running: download, build, install.
	phase: ScriptUpdatePhase | null;
	// The server starts itself again (asked by the page).
	restarting: boolean;
	// Subjects of the new commits on GitHub, newest first.
	changes: Array<string>;
};

export type ScriptChange = { kind: 'feat' | 'fix'; text: string };

// What is new, from the commit subjects (Conventional Commits): new features
// and fixes; docs, tests and chores are left out. "feat(app): a b" -> a b.
export function describeChanges(subjects: Array<string>): Array<ScriptChange> {
	const changes: Array<ScriptChange> = [];
	for (const subject of subjects) {
		const match = /^(feat|fix)(\([^)]*\))?!?:\s*(.+)$/.exec(subject);
		if (!match) continue;
		const text = match[3].trim();
		changes.push({ kind: match[1] as 'feat' | 'fix', text: text[0].toUpperCase() + text.slice(1) });
	}
	return changes;
}

const STATES = new Set(['idle', 'running', 'done', 'failed']);
const PHASES = new Set(['pull', 'build', 'install']);

function parseVersion(data: unknown): ScriptVersion | null {
	if (!data || typeof data !== 'object') return null;
	const raw = data as Record<string, unknown>;
	if (typeof raw.commit !== 'string' || typeof raw.date !== 'string') return null;
	return {
		describe: typeof raw.describe === 'string' ? raw.describe : null,
		commit: raw.commit,
		date: raw.date
	};
}

// "0.4.1+40": release 0.4.1 and 40 changes after it; "0.4.1" exactly the
// release; without release tags only the commit.
export function versionName(version: ScriptVersion): {
	name: string;
	base: string | null;
	count: number;
} {
	const match = /^desktop-v(.+)-(\d+)-g[0-9a-f]+$/.exec(version.describe ?? '');
	if (!match) return { name: version.commit, base: null, count: 0 };
	const count = Number(match[2]);
	return { name: count ? `${match[1]}+${count}` : match[1], base: match[1], count };
}

// The version this page was built from (vite.config.ts reads it from git).
export const BUILD_VERSION: ScriptVersion | null = (() => {
	const env = import.meta.env as Record<string, string | undefined>;
	const commit = env.VITE_GOTV_COMMIT;
	const date = env.VITE_GOTV_DATE;
	if (!commit || !date) return null;
	return { describe: env.VITE_GOTV_DESCRIBE || null, commit, date };
})();

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
		log: Array.isArray(raw.log) ? raw.log.filter((line) => typeof line === 'string') : [],
		current: parseVersion(raw.current),
		target: parseVersion(raw.target),
		phase:
			typeof raw.phase === 'string' && PHASES.has(raw.phase)
				? (raw.phase as ScriptUpdatePhase)
				: null,
		restarting: raw.restarting === true,
		changes: Array.isArray(raw.changes)
			? raw.changes.filter((line): line is string => typeof line === 'string')
			: []
	};
}

// GET the state, or POST "check" / "run" (with the header the server wants
// from the page itself).
export async function requestScriptUpdate(
	action: 'status' | 'check' | 'run' | 'restart',
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
