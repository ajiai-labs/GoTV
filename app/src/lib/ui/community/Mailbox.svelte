<script lang="ts">
	// Messages other players left for us while we were away (KGS MESSAGES at
	// login), and the form to leave one. "Gelesen – löschen" removes them
	// at KGS.
	import { app } from '#lib/app.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import LeaveMessageForm from './LeaveMessageForm.svelte';

	const uid = $props.id();
	let mailbox = $derived(app.state.mailbox);
</script>

<section class="Mailbox panel" aria-labelledby="{uid}-title" id="nachrichten">
	<h2 id="{uid}-title" class="panel-title">{t('community.mailbox.title')}</h2>
	<div class="Mailbox-body">
		{#if mailbox.length}
			<ul class="Mailbox-list">
				{#each mailbox as message, index (index)}
					<li>
						<div class="Mailbox-head">
							<button
								type="button"
								class="Mailbox-from"
								onclick={() => app.actions.onUserDetail(message.from)}
							>
								{message.from}
							</button>
							{#if message.time}
								<span class="muted">{formatLocaleDateTime(message.time)}</span>
							{/if}
						</div>
						<p class="Mailbox-text">{message.text}</p>
					</li>
				{/each}
			</ul>
			<button type="button" class="button" onclick={() => app.actions.onDeleteMailbox()}>
				{t('community.mailbox.delete')}
			</button>
		{:else}
			<p class="muted">{t('community.mailbox.empty')}</p>
		{/if}
		<h3 class="Mailbox-subtitle">{t('community.message.title')}</h3>
		<LeaveMessageForm />
	</div>
</section>

<style>
	.Mailbox-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0 16px 16px;
	}

	.Mailbox-body p {
		margin: 0;
	}

	.Mailbox-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.Mailbox-list li {
		padding: 8px 0;
		border-bottom: 1px solid var(--rule);
	}

	.Mailbox-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.Mailbox-from {
		border: 0;
		background: none;
		padding: 0;
		color: var(--ink);
		font-weight: 650;
		cursor: pointer;
	}

	.Mailbox-text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.Mailbox-subtitle {
		margin: 8px 0 0;
		font-size: 1rem;
	}
</style>
