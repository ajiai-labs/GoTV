<script lang="ts">
	// Shown while logged in but the KGS connection is gone (old OfflineAlert).
	import { app } from '#lib/app.svelte.ts';
	import { kgsMessage } from './kgsText.ts';

	let text = $derived.by(() => {
		const { logoutError, clientState } = app.state;
		let result = 'Verbindung zu KGS getrennt';
		if (logoutError) result += ` – ${(kgsMessage(logoutError) ?? '').replace(/\.$/, '')}`;
		if (clientState.retryTimes) result += '. Neuer Verbindungsversuch läuft …';
		if (!logoutError && !clientState.retryTimes) result += '. Bitte melde dich neu an.';
		return result;
	});
</script>

<div class="offline" role="alert">
	<span>{text}</span>
	<button class="button" onclick={() => app.actions.onLogout()}>Abmelden</button>
</div>

<style>
	.offline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
		padding: 8px 12px;
		border-radius: var(--radius-s);
		background: var(--danger-bg, #f9e0dd);
		color: var(--danger-ink, #7a1d14);
	}
</style>
