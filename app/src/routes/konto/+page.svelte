<script lang="ts">
	// Konto (old MoreScreen + MoreMenu): your KGS name (opens your profile),
	// "Profil ansehen", "Abmelden", the settings, messages, the friend lists
	// and "Über GoTV".
	import { t } from '#lib/i18n/index.svelte.ts';
	import { resolve } from '$app/paths';
	import { version } from '../../../package.json';
	import { app } from '#lib/app.svelte.ts';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import UserName from '#lib/ui/UserName.svelte';
	import FriendLists from '#lib/ui/community/FriendLists.svelte';
	import Mailbox from '#lib/ui/community/Mailbox.svelte';
	import NoChatsSetting from '#lib/ui/community/NoChatsSetting.svelte';
	import { DESKTOP_VERSION } from '#lib/desktopUpdate.ts';

	function showProfile() {
		const user = app.state.currentUser;
		if (user) app.actions.onUserDetail(user.name);
	}
</script>

<svelte:head>
	<title>{t('app.account.pageTitle')}</title>
</svelte:head>

<KgsGate>
	<div class="MoreScreen">
		<h1>{t('app.account.title')}</h1>

		<section class="panel account">
			<h2 class="panel-title">{t('app.account.loggedIn')}</h2>
			<div class="body">
				<button class="me" type="button" onclick={showProfile}>
					<UserName user={app.state.currentUser} />
				</button>
				<nav class="menu" aria-label={t('app.account.title')}>
					<button class="button" type="button" onclick={showProfile}>
						{t('app.account.viewProfile')}
					</button>
					<a class="button" href={resolve('/einstellungen')}>{t('app.layout.settings')}</a>
					<button class="button" type="button" onclick={() => app.actions.onLogout()}>
						{t('app.account.logout')}
					</button>
				</nav>
			</div>
		</section>

		<Mailbox />
		<FriendLists />
		<NoChatsSetting />

		<section class="panel about">
			<h2 class="panel-title">{t('app.account.about')}</h2>
			<div class="body">
				<p class="title">
					GoTV <span class="muted">
						{t('app.account.version', { version: DESKTOP_VERSION ?? version })}
					</span>
				</p>
				<p class="links">
					<button class="button" type="button" onclick={() => app.actions.onShowFeedbackModal()}>
						{t('app.account.sendFeedback')}
					</button>
					<a
						class="button"
						href="https://github.com/ajiai-labs/GoTV"
						target="_blank"
						rel="noopener noreferrer"
					>
						{t('app.layout.github')}
					</a>
					<a class="button" href="https://www.gokgs.com/" target="_blank" rel="noopener noreferrer">
						{t('app.account.kgsWebsite')}
					</a>
				</p>
				<p class="muted origin">
					{t('app.account.origin')}
				</p>
			</div>
		</section>
	</div>
</KgsGate>

<style>
	.MoreScreen {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		max-width: 640px;
	}

	h1 {
		margin: 8px 0 0;
		font-size: clamp(1.5rem, 2.6vw, 2.1rem);
		letter-spacing: -0.015em;
	}

	.body {
		padding: 8px 16px 16px;
	}

	.me {
		display: block;
		max-width: 100%;
		margin-bottom: 12px;
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--ink);
		font-size: 1.3rem;
		font-weight: 650;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.me:hover {
		color: var(--accent);
	}

	.menu,
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.about p {
		margin: 0 0 12px;
	}

	.about .origin {
		margin: 0;
		font-size: 0.9em;
	}

	.title {
		font-weight: 650;
	}

	:global([data-design='oldschool']) .MoreScreen h1 {
		font-size: 1.3rem;
	}

	:global([data-design='oldschool']) .me {
		font-size: 1.1rem;
	}
</style>
