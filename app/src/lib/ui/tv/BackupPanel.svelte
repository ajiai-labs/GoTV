<script module lang="ts">
	import type { BackupSettingName, BackupSummary } from '#lib/model/Backup.ts';
	import { locale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	const SETTING_LABELS: Record<BackupSettingName, MessageKey> = {
		design: 'replay.backup.setting.design',
		tone: 'replay.backup.setting.tone',
		language: 'replay.backup.setting.language',
		navOrder: 'replay.backup.setting.navOrder',
		sounds: 'replay.backup.setting.sounds',
		stoneSound: 'replay.backup.setting.stoneSound',
		startSound: 'replay.backup.setting.startSound',
		countdownSound: 'replay.backup.setting.countdownSound',
		messageSound: 'replay.backup.setting.messageSound',
		gameWindows: 'replay.backup.setting.gameWindows',
		katago: 'replay.backup.setting.katago'
	};

	export function formatSummary(summary: BackupSummary): string {
		const parts: Array<string> = [];
		if (summary.favoriteChannels) {
			parts.push(t('replay.backup.favoriteChannels', { count: summary.favoriteChannels }));
		}
		if (summary.favoriteEvents) {
			parts.push(t('replay.backup.favoriteEvents', { count: summary.favoriteEvents }));
		}
		if (summary.games) {
			const game = t('replay.backup.games', { count: summary.games });
			const extras: Array<string> = [];
			if (summary.bookmarks) {
				extras.push(t('replay.backup.bookmarks', { count: summary.bookmarks }));
			}
			if (summary.variationMoves) {
				extras.push(t('replay.backup.variationMoves', { count: summary.variationMoves }));
			}
			parts.push(game + (extras.length ? ' (' + extras.join(', ') + ')' : ''));
		}
		if (summary.settings) {
			const names = (summary.settingNames ?? []).map((name) => t(SETTING_LABELS[name]));
			parts.push(
				t('replay.backup.settings', { count: summary.settings }) +
					(names.length ? ' (' + names.join(', ') + ')' : '')
			);
		}
		return parts.length ? parts.join(', ') : t('replay.backup.noData');
	}
</script>

<script lang="ts">
	// "Meine Daten": carry stars, replays and settings to another device as a
	// file. Nothing leaves the browser unless the viewer saves the file.
	// Restoring only adds: what is here stays, the newer state of a game wins.
	import {
		collectBackup,
		describeBackup,
		getBackupFileName,
		parseBackup,
		restoreBackup
	} from '#lib/model/Backup.ts';
	import type { Backup } from '#lib/model/Backup.ts';

	const RELOAD_DELAY_MS = 1200;

	let {
		onRestored = () => window.location.reload()
	}: {
		// After a restore every part of GoTV has to read its data again; a
		// reload does that. Tests pass their own.
		onRestored?: () => unknown;
	} = $props();

	const uid = $props.id();

	let pending = $state.raw<Backup | null>(null);
	// Messages are built when shown, so they follow a language switch.
	let message: (() => string) | null = $state(null);
	let error: (() => string) | null = $state(null);

	function getStorage(): Storage | null {
		try {
			return window.localStorage;
		} catch {
			return null; // storage disabled
		}
	}

	function formatDate(iso: string): string {
		const date = new Date(iso);
		return isNaN(date.getTime())
			? t('replay.backup.unknownDate')
			: t('replay.backup.dateTime', {
					date: date.toLocaleDateString(locale()),
					time: date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
				});
	}

	function onSave() {
		const storage = getStorage();
		if (!storage) {
			error = () => t('replay.backup.noStorage');
			return;
		}
		const now = new Date();
		const backup = collectBackup(storage, now);
		const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = getBackupFileName(now);
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		const summary = describeBackup(backup);
		message = () => t('replay.backup.saved', { summary: formatSummary(summary) });
		error = null;
		pending = null;
	}

	function onChooseFile(e: Event & { currentTarget: HTMLInputElement }) {
		const input = e.currentTarget;
		const file = input.files && input.files[0];
		input.value = ''; // the same file can be chosen again
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const result = parseBackup(typeof reader.result === 'string' ? reader.result : '');
			if (result.ok) {
				pending = result.backup;
				error = null;
				message = null;
			} else {
				const reason = result.error;
				error = () => reason;
				pending = null;
				message = null;
			}
		};
		reader.onerror = () => {
			error = () => t('replay.backup.unreadable');
		};
		reader.readAsText(file);
	}

	function onRestore() {
		const storage = getStorage();
		if (!pending || !storage) return;
		const changed = restoreBackup(storage, pending);
		pending = null;
		message = changed ? () => t('replay.backup.restored') : () => t('replay.backup.nothingNew');
		if (changed) setTimeout(() => onRestored(), RELOAD_DELAY_MS);
	}
</script>

<section class="BackupPanel panel" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title" class="panel-title">{t('replay.backup.title')}</h2>
	<div class="BackupPanel-body">
		<p class="BackupPanel-hint">
			{t('replay.backup.hint')}
		</p>
		<div class="BackupPanel-actions">
			<button type="button" class="button BackupPanel-save" onclick={onSave}>
				{t('replay.backup.save')}
			</button>
			<label class="button BackupPanel-load">
				{t('replay.backup.load')}
				<input
					type="file"
					accept=".json,application/json"
					class="BackupPanel-input"
					onchange={onChooseFile}
				/>
			</label>
		</div>
		{#if pending}
			<div class="BackupPanel-confirm">
				<p>
					{t('replay.backup.pending', {
						date: formatDate(pending.createdAt),
						summary: formatSummary(describeBackup(pending))
					})}
				</p>
				<p class="BackupPanel-hint">
					{t('replay.backup.restoreHint')}
				</p>
				<div class="BackupPanel-actions">
					<button
						type="button"
						class="button button-primary BackupPanel-restore"
						onclick={onRestore}
					>
						{t('replay.backup.restore')}
					</button>
					<button type="button" class="button" onclick={() => (pending = null)}>
						{t('replay.cancel')}
					</button>
				</div>
			</div>
		{/if}
		{#if message}
			<p class="BackupPanel-message" role="status">{message()}</p>
		{/if}
		{#if error}
			<p class="BackupPanel-error" role="alert">{error()}</p>
		{/if}
	</div>
</section>

<style>
	.BackupPanel-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 16px 14px;
	}

	p {
		margin: 0;
	}

	.BackupPanel-hint {
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.BackupPanel-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	/* The file field stays reachable by keyboard inside its label. */
	.BackupPanel-load {
		position: relative;
		overflow: hidden;
	}

	.BackupPanel-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.BackupPanel-load:focus-within {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.BackupPanel-confirm {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		border-left: 3px solid var(--accent);
		background: var(--accent-soft);
	}

	.BackupPanel-error {
		color: var(--danger, #b3261e);
	}

	:global([data-design='oldschool']) .BackupPanel-confirm {
		border: 1px solid var(--bevel-dark, #808080);
		border-left-width: 3px;
		border-left-color: var(--accent);
		background: var(--surface-sunk);
	}
</style>
