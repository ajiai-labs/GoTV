<script lang="ts">
	// "Feedback senden" (old FeedbackModal). The old form mailed the Shin KGS
	// author; GoTV has no mail service and its GitHub issues are switched off,
	// so this points to the project page on GitHub instead.
	import type { User } from '#lib/model/types.ts';
	import Modal from './Modal.svelte';

	let {
		onClose,
		currentUser = null
	}: {
		onClose: () => unknown;
		currentUser?: User | null;
	} = $props();
</script>

<Modal title="Feedback" onclose={() => onClose()}>
	<div class="FeedbackModal">
		<p>
			Fehler gefunden oder einen Wunsch für GoTV? GoTV wird auf GitHub entwickelt. Dort findest du
			das Projekt und wie du Kontakt aufnimmst.
		</p>
		{#if currentUser}
			<!-- The old form filled in your name; here it is a hint for your message. -->
			<p class="muted">Nenne gern deinen KGS-Namen ({currentUser.name}), wenn es um KGS geht.</p>
		{/if}
		<div class="buttons">
			<a
				class="button button-primary"
				href="https://github.com/ajiai-labs/GoTV"
				target="_blank"
				rel="noopener noreferrer"
			>
				GoTV auf GitHub öffnen
			</a>
			<button class="button" type="button" onclick={() => onClose()}>Schließen</button>
		</div>
	</div>
</Modal>

<style>
	.FeedbackModal p {
		margin: 8px 0 16px;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
