<script lang="ts">
	// A dialog over the page (native <dialog>: focus stays inside, Esc closes).
	import type { Snippet } from 'svelte';

	let {
		title,
		onclose,
		children,
		wide = false
	}: {
		title: string;
		onclose: () => void;
		children: Snippet;
		wide?: boolean;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});
</script>

<dialog
	bind:this={dialog}
	class="modal"
	class:wide
	aria-label={title}
	{onclose}
	onclick={(e) => {
		if (e.target === dialog) onclose();
	}}
>
	<header>
		<h2 class="panel-title">{title}</h2>
		<button class="close" onclick={onclose} aria-label="Schließen">×</button>
	</header>
	<div class="body">
		{@render children()}
	</div>
</dialog>

<style>
	.modal {
		width: min(560px, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		padding: 0;
		border: var(--panel-border);
		border-color: var(--rule);
		border-radius: var(--radius-m);
		background: var(--surface);
		color: var(--ink);
	}

	.wide {
		width: min(900px, calc(100vw - 24px));
	}

	.modal::backdrop {
		background: rgba(0, 0, 0, 0.4);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--title-bar);
	}

	header .panel-title {
		padding-bottom: 12px;
		/* the header already carries the title bar (Oldschool gradient) */
		background: none;
	}

	.close {
		border: 0;
		background: none;
		color: var(--title-ink);
		font-size: 1.5rem;
		padding: 4px 14px;
		cursor: pointer;
	}

	.body {
		padding: 0 16px 16px;
	}
</style>
