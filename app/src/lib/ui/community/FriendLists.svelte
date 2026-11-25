<script lang="ts">
	// The three KGS lists of CGoban's "Benutzer" menu: Freunde (buddy),
	// Ignorierliste (censored - their chat is hidden in GoTV) and Fanliste
	// (fan). Add a name with an optional note, remove with ×, a name opens
	// the profile. Changes go to KGS; the list follows KGS's answer.
	import { app } from '#lib/app.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { FRIEND_TYPES } from '#lib/model/community.ts';
	import type { FriendType } from '#lib/model/community.ts';

	const uid = $props.id();
	let tab: FriendType = $state('buddy');
	let name = $state('');
	let notes = $state('');

	let list = $derived(app.state.friends.filter((f) => f.type === tab));
	let noUser = $derived(app.state.communityResult?.type === 'FRIEND_CHANGE_NO_USER');

	function onAdd(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;
		app.actions.onClearCommunityResult();
		app.actions.onAddFriend(tab, name, notes);
		name = '';
		notes = '';
	}
</script>

<section class="FriendLists panel" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title" class="panel-title">{t('community.friends.title')}</h2>
	<div class="FriendLists-tabs" role="tablist" aria-label={t('community.friends.title')}>
		{#each FRIEND_TYPES as type (type)}
			<button
				type="button"
				role="tab"
				class="FriendLists-tab"
				aria-selected={tab === type}
				onclick={() => (tab = type)}
			>
				{t(`community.friends.${type}`)}
				<span class="muted">({app.state.friends.filter((f) => f.type === type).length})</span>
			</button>
		{/each}
	</div>
	<p class="FriendLists-hint muted">{t(`community.friends.${tab}Hint`)}</p>
	{#if list.length}
		<ul class="FriendLists-list">
			{#each list as friend (friend.name)}
				<li>
					<button
						type="button"
						class="FriendLists-name"
						onclick={() => app.actions.onUserDetail(friend.name)}
					>
						{friend.name}{#if friend.rank}&nbsp;<span class="muted">[{friend.rank}]</span>{/if}
					</button>
					{#if friend.notes}<span class="FriendLists-notes muted">{friend.notes}</span>{/if}
					<button
						type="button"
						class="FriendLists-remove"
						aria-label={t('community.friends.remove', { name: friend.name })}
						title={t('community.friends.remove', { name: friend.name })}
						onclick={() => app.actions.onRemoveFriend(friend.type, friend.name)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="FriendLists-empty muted">{t('community.friends.empty')}</p>
	{/if}
	<form class="FriendLists-add" onsubmit={onAdd}>
		<label>
			<span>{t('community.friends.name')}</span>
			<input type="text" bind:value={name} maxlength="10" autocomplete="off" required />
		</label>
		<label>
			<span>{t('community.friends.notes')}</span>
			<input type="text" bind:value={notes} maxlength="50" autocomplete="off" />
		</label>
		<button type="submit" class="button">{t('community.friends.add')}</button>
	</form>
	{#if noUser}
		<p class="FriendLists-error" role="alert">{t('community.friends.noUser')}</p>
	{/if}
</section>

<style>
	.FriendLists {
		padding-bottom: 12px;
	}

	.FriendLists-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 0 12px;
	}

	.FriendLists-tab {
		padding: 6px 12px;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: none;
		color: var(--ink);
		cursor: pointer;
	}

	.FriendLists-tab[aria-selected='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
		font-weight: 650;
	}

	.FriendLists-hint,
	.FriendLists-empty,
	.FriendLists-error {
		margin: 8px 16px;
	}

	.FriendLists-error {
		color: #c0392b;
	}

	.FriendLists-list {
		list-style: none;
		margin: 8px 0;
		padding: 0;
	}

	.FriendLists-list li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 16px;
		border-bottom: 1px solid var(--rule);
	}

	.FriendLists-name {
		border: 0;
		background: none;
		color: var(--ink);
		font-weight: 600;
		cursor: pointer;
		padding: 4px 0;
	}

	.FriendLists-name:hover {
		color: var(--accent);
	}

	.FriendLists-notes {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.FriendLists-remove {
		margin-left: auto;
		min-width: 32px;
		min-height: 32px;
		border: 0;
		background: none;
		color: var(--ink-soft);
		font-size: 1.2rem;
		cursor: pointer;
	}

	.FriendLists-add {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 12px;
		padding: 8px 16px 0;
	}

	.FriendLists-add label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
</style>
