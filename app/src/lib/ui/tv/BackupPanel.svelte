<script module lang="ts">
	import type { BackupSummary } from '#lib/model/Backup.ts';

	function plural(count: number, one: string, many: string): string {
		return String(count) + ' ' + (count === 1 ? one : many);
	}

	export function formatSummary(summary: BackupSummary): string {
		const parts: Array<string> = [];
		if (summary.favoriteChannels) {
			parts.push(plural(summary.favoriteChannels, 'Lieblingskanal', 'Lieblingskanäle'));
		}
		if (summary.favoriteEvents) {
			parts.push(plural(summary.favoriteEvents, 'Lieblingsturnier', 'Lieblingsturniere'));
		}
		if (summary.games) {
			const game = plural(summary.games, 'nachgespielte Partie', 'nachgespielte Partien');
			const extras: Array<string> = [];
			if (summary.bookmarks) extras.push(plural(summary.bookmarks, 'Lesezeichen', 'Lesezeichen'));
			if (summary.variationMoves) {
				extras.push(plural(summary.variationMoves, 'Variantenzug', 'Variantenzüge'));
			}
			parts.push(game + (extras.length ? ' (' + extras.join(', ') + ')' : ''));
		}
		if (summary.settings) {
			parts.push(plural(summary.settings, 'Einstellung', 'Einstellungen'));
		}
		return parts.length ? parts.join(', ') : 'keine Daten';
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
	let message: string | null = $state(null);
	let error: string | null = $state(null);

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
			? 'unbekanntem Datum'
			: date.toLocaleDateString('de-DE') +
					', ' +
					date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) +
					' Uhr';
	}

	function onSave() {
		const storage = getStorage();
		if (!storage) {
			error = 'Dieser Browser speichert keine Daten.';
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
		message = 'Sicherung gespeichert: ' + formatSummary(describeBackup(backup)) + '.';
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
				error = result.error;
				pending = null;
				message = null;
			}
		};
		reader.onerror = () => {
			error = 'Die Datei konnte nicht gelesen werden.';
		};
		reader.readAsText(file);
	}

	function onRestore() {
		const storage = getStorage();
		if (!pending || !storage) return;
		const changed = restoreBackup(storage, pending);
		pending = null;
		message = changed
			? 'Sicherung übernommen. GoTV lädt neu …'
			: 'Nichts zu übernehmen – diese Daten sind schon hier.';
		if (changed) setTimeout(() => onRestored(), RELOAD_DELAY_MS);
	}
</script>

<section class="BackupPanel panel" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title" class="panel-title">Meine Daten</h2>
	<div class="BackupPanel-body">
		<p class="BackupPanel-hint">
			Favoriten, nachgespielte Partien mit Lesezeichen und Varianten, Einstellungen – nur in diesem
			Browser. Mit einer Sicherungsdatei nimmst du sie auf ein anderes Gerät mit.
		</p>
		<div class="BackupPanel-actions">
			<button type="button" class="button BackupPanel-save" onclick={onSave}>
				Sicherung speichern
			</button>
			<label class="button BackupPanel-load">
				Sicherung einspielen …
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
					Sicherung vom {formatDate(pending.createdAt)}: {formatSummary(describeBackup(pending))}.
				</p>
				<p class="BackupPanel-hint">
					Einspielen ergänzt nur: Was hier schon gespeichert ist, bleibt erhalten; bei derselben
					Partie gilt der neuere Stand.
				</p>
				<div class="BackupPanel-actions">
					<button
						type="button"
						class="button button-primary BackupPanel-restore"
						onclick={onRestore}
					>
						Einspielen
					</button>
					<button type="button" class="button" onclick={() => (pending = null)}>Abbrechen</button>
				</div>
			</div>
		{/if}
		{#if message}
			<p class="BackupPanel-message" role="status">{message}</p>
		{/if}
		{#if error}
			<p class="BackupPanel-error" role="alert">{error}</p>
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
		border: 1px solid #808080;
		border-left-width: 3px;
		border-left-color: var(--accent);
		background: var(--surface-sunk);
	}
</style>
