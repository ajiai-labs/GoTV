<script lang="ts">
	// Suche (old SearchScreen): type a KGS user name and open the profile.
	// Known users whose name matches are listed below, strongest first.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import type { User } from '#lib/model/types.ts';
	import { sortUsers } from '#lib/model/user.ts';
	import { distinctBy } from '#lib/util/collection.ts';
	import { isTouchDevice } from '#lib/util/dom.ts';
	import { quoteRegExpPattern } from '#lib/util/string.ts';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import UserList from '#lib/ui/user/UserList.svelte';

	let query = $state('');
	let input: HTMLInputElement | undefined = $state();

	let users = $derived.by(() => {
		const queryRe = new RegExp(quoteRegExpPattern(query), 'i');
		const usersByName = app.state.usersByName;
		const found = distinctBy(
			Object.keys(usersByName)
				.filter((name) => queryRe.test(name))
				.map((name) => usersByName[name]),
			(user) => user.name
		);
		sortUsers(found);
		return found;
	});

	onMount(() => {
		window.scrollTo(0, 0);
	});

	// The input appears once the KGS gate lets the page through.
	$effect(() => {
		if (input && !isTouchDevice()) input.focus();
	});

	function lookup(event: SubmitEvent) {
		event.preventDefault();
		if (!query.trim()) return;
		app.actions.onUserDetail(query.toLowerCase());
	}

	function selectUser(user: User) {
		app.actions.onUserDetail(user.name);
	}
</script>

<svelte:head>
	<title>{t('app.search.pageTitle')}</title>
</svelte:head>

<KgsGate>
	<div class="SearchScreen">
		<h1>{t('app.search.title')}</h1>
		<form class="search panel" role="search" onsubmit={lookup}>
			<input
				type="text"
				aria-label={t('app.search.userName')}
				placeholder={t('app.search.userName')}
				autocomplete="off"
				autocorrect="off"
				autocapitalize="none"
				spellcheck="false"
				bind:value={query}
				bind:this={input}
			/>
			<button class="button button-primary" type="submit">{t('app.account.viewProfile')}</button>
		</form>
		{#if users.length}
			<section class="users panel" aria-label={t('app.search.found')}>
				<UserList {users} onSelectUser={selectUser} />
			</section>
		{/if}
	</div>
</KgsGate>

<style>
	.SearchScreen {
		max-width: 640px;
	}

	h1 {
		margin: 8px 0 20px;
		font-size: clamp(1.5rem, 2.6vw, 2.1rem);
		letter-spacing: -0.015em;
	}

	.search {
		display: flex;
		gap: 8px;
		padding: 10px;
	}

	.search input {
		flex: 1;
		min-width: 0;
		font: inherit;
		padding: 9px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
	}

	.users {
		margin-top: var(--gap);
		padding: 6px;
	}

	:global([data-design='oldschool']) .search input {
		padding: 3px 5px;
		border: 2px inset #ece9e2;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .SearchScreen h1 {
		font-size: 1.3rem;
	}
</style>
