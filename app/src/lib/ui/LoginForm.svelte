<script lang="ts">
	// KGS login, as in the old LoginScreen: user name (remembered), password
	// (only remembered when "Passwort speichern" is ticked, in this browser's
	// IndexedDB like before), errors from KGS or the network.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { get, set } from 'idb-keyval';
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { kgsMessage } from './kgsText.ts';

	type SavedLogin = {
		username: string | null;
		savePassword: boolean | null;
		password: string | null;
	};

	let username = $state(app.state.preferences.username || '');
	let password = $state('');
	let savePassword = $state(false);

	let loggingIn = $derived(app.state.clientState.status === 'loggingIn');
	let error = $derived(
		kgsMessage(app.state.loginError) ||
			(app.state.clientState.network !== 'online' ? t('app.login.unreachable') : null)
	);

	onMount(() => {
		get<SavedLogin>('savedLogin')
			.then((saved) => {
				if (!saved) return;
				if (saved.savePassword !== null) savePassword = saved.savePassword;
				if (saved.password !== null) password = saved.password;
				if (saved.username) username = saved.username;
			})
			.catch(() => {
				// no saved login (storage unavailable)
			});
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		app.actions.onLogin(username, password);
		if (username && password) {
			const saved: SavedLogin = {
				username,
				savePassword,
				password: savePassword ? password : null
			};
			set('savedLogin', saved).catch(() => {
				// not remembered without storage
			});
		}
	}
</script>

<form class="login panel" onsubmit={submit}>
	<h2 class="panel-title">{t('app.login.title')}</h2>
	<div class="fields">
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		<label>
			<span>{t('app.search.userName')}</span>
			<input
				type="text"
				autocomplete="username"
				autocorrect="off"
				autocapitalize="none"
				spellcheck="false"
				bind:value={username}
			/>
		</label>
		<label>
			<span>{t('app.login.password')}</span>
			<input type="password" autocomplete="current-password" bind:value={password} />
		</label>
		<label class="check">
			<input type="checkbox" bind:checked={savePassword} />
			<span>{t('app.login.savePassword')}</span>
		</label>
		<button class="button button-primary" type="submit" disabled={loggingIn}>
			{loggingIn ? t('app.login.loggingIn') : t('app.layout.login')}
		</button>
		<p class="links">
			<a href="https://www.gokgs.com/register" target="_blank" rel="noopener noreferrer">
				{t('app.login.register')}
			</a>
			<a href="https://www.gokgs.com/password.jsp" target="_blank" rel="noopener noreferrer">
				{t('app.login.forgotPassword')}
			</a>
		</p>
	</div>
</form>

<style>
	.login {
		max-width: 420px;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 16px 16px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	label span {
		font-size: 0.9em;
		color: var(--ink-soft);
	}

	input[type='text'],
	input[type='password'] {
		font: inherit;
		padding: 9px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
	}

	.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}

	.check span {
		color: var(--ink);
	}

	.error {
		margin: 0;
		padding: 10px 12px;
		border-radius: var(--radius-s);
		background: var(--danger-bg, #f9e0dd);
		color: var(--danger-ink, #7a1d14);
	}

	.links {
		display: flex;
		gap: 16px;
		margin: 0;
		font-size: 0.9em;
	}

	button[type='submit'] {
		align-self: flex-start;
	}
</style>
