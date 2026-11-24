<script lang="ts">
	// One value of a challenge proposal (time, board size, handicap, komi)
	// with − and + buttons. Read-only: the buttons are switched off.
	// Highlighted: the value differs from the previous proposal.
	let {
		value,
		label,
		readonly = false,
		hilited = false,
		onMinus,
		onPlus
	}: {
		value: string | number;
		label: string;
		readonly?: boolean;
		hilited?: boolean;
		onMinus: () => unknown;
		onPlus: () => unknown;
	} = $props();

	function minus() {
		if (!readonly) onMinus();
	}

	function plus() {
		if (!readonly) onPlus();
	}
</script>

<div
	class="ProposalForm-input"
	class:ProposalForm-input-readonly={readonly}
	class:ProposalForm-input-hilite={hilited}
	role="group"
	aria-label={label}
>
	<div class="ProposalForm-input-value">
		<output aria-live="polite">{value}</output>
		<span class="ProposalForm-input-value-label">
			{label}{#if hilited}<span class="sr-only"> (geändert)</span>{/if}
		</span>
	</div>
	<div class="ProposalForm-input-plusminus">
		<button
			type="button"
			class="ProposalForm-input-minus"
			aria-label="{label} verringern"
			disabled={readonly}
			onclick={minus}
		>
			−
		</button>
		<button
			type="button"
			class="ProposalForm-input-plus"
			aria-label="{label} erhöhen"
			disabled={readonly}
			onclick={plus}
		>
			+
		</button>
	</div>
</div>

<style>
	.ProposalForm-input {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 52px;
		padding: 4px 0;
	}

	.ProposalForm-input-value {
		display: flex;
		flex-direction: column;
		min-width: 76px;
		padding: 3px 10px;
		border-radius: var(--radius-s);
		text-align: center;
		line-height: 1.2;
	}

	.ProposalForm-input-value output {
		font-size: 1.2rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}

	.ProposalForm-input-hilite .ProposalForm-input-value {
		background: var(--hilite, #fff1a9);
		color: var(--paper-ink, #1d2421);
	}

	.ProposalForm-input-hilite .ProposalForm-input-value-label {
		color: var(--warn-ink, #4b4b3a);
	}

	.ProposalForm-input-value-label {
		font-size: 0.82em;
		color: var(--ink-soft);
	}

	.ProposalForm-input-plusminus {
		display: flex;
		gap: 8px;
	}

	.ProposalForm-input-minus,
	.ProposalForm-input-plus {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--accent);
		border-radius: 50%;
		background: var(--surface);
		color: var(--accent);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	.ProposalForm-input-minus:hover:not(:disabled),
	.ProposalForm-input-plus:hover:not(:disabled) {
		background: var(--accent-soft);
	}

	.ProposalForm-input-minus:disabled,
	.ProposalForm-input-plus:disabled {
		border-color: var(--rule);
		color: var(--ink-soft);
		opacity: 0.5;
		cursor: default;
	}

	:global([data-design='oldschool']) .ProposalForm-input-minus,
	:global([data-design='oldschool']) .ProposalForm-input-plus {
		width: 32px;
		height: 32px;
		border: var(--button-border);
		border-radius: 0;
		background: var(--button-bg);
		color: var(--ink);
	}

	:global([data-design='oldschool']) .ProposalForm-input-minus:active:not(:disabled),
	:global([data-design='oldschool']) .ProposalForm-input-plus:active:not(:disabled) {
		border-style: inset;
	}

	:global([data-design='oldschool']) .ProposalForm-input-value {
		border: 2px inset #ece9e2;
		border-radius: 0;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .ProposalForm-input-hilite .ProposalForm-input-value {
		background: var(--warn-bg, #fff1a9);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
