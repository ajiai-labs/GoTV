<script lang="ts">
	// Shown for KGS features the app does not offer yet (old
	// UnderConstructionModal), e.g. setting up a game for some game types.
	import Modal from './Modal.svelte';

	let { onClose }: { onClose: () => unknown } = $props();
</script>

<Modal title="Noch nicht verfügbar" onclose={() => onClose()}>
	<div class="UnderConstructionModal">
		<p>Diese Funktion gibt es in GoTV noch nicht.</p>
		<p>
			Mithelfen? GoTV wird auf
			<a href="https://github.com/ajiai-labs/GoTV" target="_blank" rel="noopener noreferrer">
				GitHub
			</a>
			entwickelt.
		</p>
		<button class="button button-primary" type="button" onclick={() => onClose()}>OK</button>
	</div>
</Modal>

<style>
	.UnderConstructionModal p {
		margin: 8px 0 12px;
	}

	.UnderConstructionModal button {
		margin-top: 4px;
	}
</style>
