<script lang="ts">
	// Wraps every KGS page (Beobachten, Spielen, Chat, Suche, Konto): shows the
	// page when logged in, the login form when not, and in the web version
	// (GitHub Pages) a note - KGS only answers its own website, so KGS works
	// in the desktop app only.
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Snippet } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { config } from '#lib/config.ts';
	import LoginForm from './LoginForm.svelte';
	import Spinner from './Spinner.svelte';

	let { children }: { children: Snippet } = $props();
</script>

{#if config.guestOnly}
	<section class="note panel">
		<h2 class="panel-title">{t('app.gate.title')}</h2>
		<p>
			{t('app.gate.text')}
		</p>
		<p>
			<a href="https://github.com/ajiai-labs/GoTV#desktop-installation-linux-gnome">
				{t('app.gate.install')}
			</a>
		</p>
	</section>
{:else if !app.started || !app.state.initialized}
	<Spinner />
{:else if !app.loggedIn}
	<LoginForm />
{:else}
	{@render children()}
{/if}

<style>
	.note {
		max-width: 640px;
	}

	.note p {
		margin: 8px 16px 16px;
	}
</style>
