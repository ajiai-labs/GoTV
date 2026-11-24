<script lang="ts">
	// Shown for KGS features the app does not offer yet (old
	// UnderConstructionModal), e.g. setting up a game for some game types.
	import { t } from '#lib/i18n/index.svelte.ts';
	import Modal from './Modal.svelte';

	let { onClose }: { onClose: () => unknown } = $props();
</script>

<Modal title={t('app.underConstruction.title')} onclose={() => onClose()}>
	<div class="UnderConstructionModal">
		<p>{t('app.underConstruction.text')}</p>
		<p>
			{t('app.underConstruction.helpBefore')}
			<a href="https://github.com/ajiai-labs/GoTV" target="_blank" rel="noopener noreferrer">
				GitHub
			</a>
			{t('app.underConstruction.helpAfter')}
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
