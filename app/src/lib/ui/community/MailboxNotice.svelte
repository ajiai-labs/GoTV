<script lang="ts">
	// Messages waiting on KGS (left while we were away): a short notice at
	// the top with a link to Konto, where they are shown.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let count = $derived(app.state.mailbox.length);
	let onAccount = $derived(page.url.pathname.endsWith('/konto'));
</script>

{#if count && !onAccount}
	<aside class="MailboxNotice panel" role="status">
		<span>{t('community.mailbox.notice', { count })}</span>
		<a class="button" href={resolve('/konto') + '#nachrichten'}>{t('community.mailbox.show')}</a>
	</aside>
{/if}

<style>
	.MailboxNotice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		margin: 10px auto 0;
		max-width: 1000px;
		padding: 8px 14px;
		border-left: 4px solid var(--accent);
	}
</style>
