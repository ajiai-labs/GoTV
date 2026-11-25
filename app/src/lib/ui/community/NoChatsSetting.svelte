<script lang="ts">
	// "Keine Unterhaltungen" (CGoban): a switch; while on, new private chats
	// are declined (AppActions.onDeclineConversation). The last declined
	// player is named below.
	import { app } from '#lib/app.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { loadNoChats, saveNoChats } from '#lib/model/noChats.ts';

	const uid = $props.id();
	let on = $state(loadNoChats());
	let declined = $derived(
		app.state.communityResult?.type === 'CHAT_DECLINED' ? app.state.communityResult.name : null
	);

	function onChange() {
		on = !on;
		saveNoChats(on);
	}
</script>

<section class="NoChatsSetting panel" aria-labelledby="{uid}-title">
	<label class="NoChatsSetting-switch">
		<input type="checkbox" checked={on} onchange={onChange} />
		<strong id="{uid}-title">{t('community.noChats.title')}</strong>
	</label>
	<p class="muted">{t('community.noChats.description')}</p>
	{#if declined}
		<p role="status">{t('community.noChats.declined', { name: declined })}</p>
	{/if}
</section>

<style>
	.NoChatsSetting {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
	}

	.NoChatsSetting p {
		margin: 0;
	}

	.NoChatsSetting-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
</style>
