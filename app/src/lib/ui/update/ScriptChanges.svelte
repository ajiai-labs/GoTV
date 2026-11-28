<script lang="ts">
	// "Was ist neu" of an update of the script installation: the new
	// features and fixes from the commits, folded away until clicked - the
	// notice stays one line (user, 28.11.2026: not in the way while playing).
	import { t } from '#lib/i18n/index.svelte.ts';
	import { describeChanges } from '#lib/model/scriptUpdate.ts';

	let { subjects }: { subjects: Array<string> } = $props();

	let changes = $derived(describeChanges(subjects));
</script>

{#if changes.length}
	<details class="ScriptChanges">
		<summary>{t('app.update.whatsNew')}</summary>
		<ul>
			{#each changes as change, i (i)}
				<li>
					<span class="kind">
						{change.kind === 'feat' ? t('app.update.kindFeat') : t('app.update.kindFix')}
					</span>
					{change.text}
				</li>
			{/each}
		</ul>
	</details>
{/if}

<style>
	.ScriptChanges summary {
		cursor: pointer;
		color: var(--accent);
	}

	.ScriptChanges ul {
		margin: 6px 0 0;
		padding-left: 1.2rem;
		max-height: 12rem;
		overflow: auto;
	}

	.ScriptChanges .kind {
		font-weight: 600;
	}
</style>
