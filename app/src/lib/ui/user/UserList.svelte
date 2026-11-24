<script lang="ts">
	// A list of KGS users (room, game, search). Offline users are faded. Long
	// lists render the first 40 at once and the rest a moment later, so a
	// full room opens without a pause.
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import type { User } from '#lib/model/types.ts';
	import UserName from '#lib/ui/UserName.svelte';

	const FIRST_RENDER = 40;

	let {
		users,
		onSelectUser = (user: User) => app.actions.onUserDetail(user.name)
	}: {
		users: Array<User>;
		onSelectUser?: (user: User) => unknown;
	} = $props();

	let fullRender = $state(false);
	let shown = $derived(fullRender ? users : users.slice(0, FIRST_RENDER));

	onMount(() => {
		if (users.length <= FIRST_RENDER) return;
		const timer = setTimeout(() => (fullRender = true), 32);
		return () => clearTimeout(timer);
	});
</script>

<ul class="UserList">
	{#each shown as user (user.name)}
		<li class="UserList-item" class:UserList-item-offline={!user.flags?.connected}>
			<button type="button" class="UserList-item-name" onclick={() => onSelectUser(user)}>
				<UserName {user} extraIcons />
			</button>
		</li>
	{/each}
</ul>

<style>
	.UserList {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.UserList-item-name {
		display: block;
		width: 100%;
		min-height: 32px;
		padding: 4px 8px;
		border: 0;
		border-radius: var(--radius-s);
		background: none;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.UserList-item-name:hover {
		background: var(--accent-soft);
	}

	.UserList-item-offline .UserList-item-name {
		opacity: 0.5;
	}

	.UserList-item-offline .UserList-item-name:hover,
	.UserList-item-offline .UserList-item-name:focus-visible {
		opacity: 1;
	}

	:global([data-design='oldschool']) .UserList-item-name {
		min-height: 24px;
		padding: 2px 6px;
	}

	:global([data-design='oldschool']) .UserList-item-name:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
