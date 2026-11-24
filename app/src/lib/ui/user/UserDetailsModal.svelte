<script lang="ts">
	// Placeholder until the user details are built (phase 2b).
	import { app } from '#lib/app.svelte.ts';
	import Modal from '../Modal.svelte';
</script>

<Modal
	title={app.state.userDetailsRequest?.name ?? 'Spieler'}
	onclose={() => app.actions.onCloseUserDetail()}
>
	<p>…</p>
</Modal>
