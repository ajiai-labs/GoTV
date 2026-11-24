<script lang="ts">
	// "Automatische Gegnerwahl" (KGS automatch) on the Spielen page: a switch
	// that starts or stops the search, and the "Autowahleinstellungen" dialog
	// with the groups of CGoban (Gegnerwahl, Spielart, Spielgeschwindigkeit).
	// When KGS finds an opponent, the game opens on its own (AppActions).
	import { app } from '#lib/app.svelte.ts';
	import {
		DEFAULT_AUTOMATCH_PREFS,
		MAX_HANDICAP_MAX,
		MAX_HANDICAP_MIN
	} from '#lib/model/automatch.ts';
	import type { AutomatchPrefs } from '#lib/model/types.ts';
	import Modal from '#lib/ui/Modal.svelte';

	type Flag = keyof Omit<AutomatchPrefs, 'maxHandicap' | 'estimatedRank'>;

	const GROUPS: Array<{ title: string; flags: Array<[Flag, string]> }> = [
		{
			title: 'Gegnerwahl',
			flags: [
				['humanOk', 'Mensch'],
				['robotOk', 'Bot'],
				['unrankedOk', 'Gegner ohne Rang']
			]
		},
		{
			title: 'Spielart',
			flags: [
				['rankedOk', 'Gewertet'],
				['freeOk', 'Frei']
			]
		},
		{
			title: 'Spielgeschwindigkeit',
			flags: [
				['mediumOk', 'Mittel'],
				['fastOk', 'Schnell'],
				['blitzOk', 'Blitz']
			]
		}
	];

	let searching = $derived(app.state.automatchEnabled);
	let prefs = $derived(app.state.automatchPrefs ?? DEFAULT_AUTOMATCH_PREFS);
	let editing = $state(false);
	let draft = $state<AutomatchPrefs>({ ...DEFAULT_AUTOMATCH_PREFS });

	// Without one of each group KGS cannot find any game.
	let missing = $derived(
		GROUPS.filter((group) => !group.flags.some(([flag]) => draft[flag])).map((g) => g.title)
	);

	function openSettings() {
		draft = { ...prefs };
		editing = true;
	}

	function changeHandicap(delta: number) {
		draft.maxHandicap = Math.max(
			MAX_HANDICAP_MIN,
			Math.min(MAX_HANDICAP_MAX, (draft.maxHandicap ?? 0) + delta)
		);
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (missing.length) return;
		app.actions.onSetAutomatchPrefs({ ...draft });
		editing = false;
	}

	function toggle() {
		if (searching) app.actions.onCancelAutomatch();
		else app.actions.onStartAutomatch();
	}
</script>

<section class="automatch panel" class:searching aria-labelledby="automatch-title">
	<h2 id="automatch-title" class="panel-title">Automatische Gegnerwahl</h2>
	<div class="body">
		<label class="switch">
			<input type="checkbox" checked={searching} onchange={toggle} />
			<span>
				{searching ? 'Suche läuft – KGS sucht einen Gegner …' : 'Gegner automatisch suchen'}
			</span>
		</label>
		<p class="summary muted">
			{GROUPS.map((group) =>
				group.flags
					.filter(([flag]) => prefs[flag])
					.map(([, label]) => label)
					.join(', ')
			)
				.filter(Boolean)
				.join(' · ')} · max. Rangunterschied {prefs.maxHandicap}
		</p>
		<button type="button" class="button" onclick={openSettings}>Autowahleinstellungen</button>
	</div>
</section>

{#if editing}
	<Modal title="Autowahleinstellungen" onclose={() => (editing = false)}>
		<form class="settings" onsubmit={save}>
			{#each GROUPS as group (group.title)}
				<fieldset>
					<legend>{group.title}</legend>
					{#each group.flags as [flag, label] (flag)}
						<label>
							<input type="checkbox" bind:checked={draft[flag]} />
							{label}
						</label>
					{/each}
					{#if group.title === 'Gegnerwahl'}
						<div class="handicap">
							<button
								type="button"
								class="button"
								aria-label="Rangunterschied verringern"
								disabled={draft.maxHandicap <= MAX_HANDICAP_MIN}
								onclick={() => changeHandicap(-1)}
							>
								−
							</button>
							<output aria-live="polite">{draft.maxHandicap}</output>
							<button
								type="button"
								class="button"
								aria-label="Rangunterschied erhöhen"
								disabled={draft.maxHandicap >= MAX_HANDICAP_MAX}
								onclick={() => changeHandicap(1)}
							>
								+
							</button>
							<span>Max. Rangunterschied</span>
						</div>
					{/if}
				</fieldset>
			{/each}
			{#if missing.length}
				<p class="error" role="alert">
					Bitte in {missing.join(' und ')} mindestens eins wählen.
				</p>
			{/if}
			<div class="actions">
				<button type="submit" class="button button-primary" disabled={missing.length > 0}>
					OK
				</button>
				<button type="button" class="button" onclick={() => (editing = false)}>Abbrechen</button>
			</div>
		</form>
	</Modal>
{/if}

<style>
	.automatch.searching {
		border-color: var(--accent);
	}

	.body {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		padding: 8px 16px 14px;
	}

	.switch {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		min-height: 44px;
		cursor: pointer;
	}

	.switch input {
		width: 20px;
		height: 20px;
		accent-color: var(--accent);
	}

	.searching .switch span {
		color: var(--accent);
	}

	.summary {
		flex: 1 1 260px;
		margin: 0;
		font-size: 0.9em;
	}

	.settings {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 8px;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 8px 12px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
	}

	legend {
		padding: 0 4px;
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	fieldset label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}

	fieldset input {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}

	.handicap {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.handicap .button {
		min-width: 36px;
		justify-content: center;
		padding: 4px 10px;
	}

	.handicap output {
		min-width: 2ch;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.error {
		margin: 0;
		color: var(--danger-ink, #7a1d14);
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	:global([data-design='oldschool']) fieldset {
		border: 2px groove #ece9e2;
		border-radius: 0;
	}
</style>
