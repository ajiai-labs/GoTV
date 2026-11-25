<script lang="ts">
	// The small GoTV logo that replaces the top bar while a board is open
	// (own game, watching, replay): the way back to the rest of the app.
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import logo from '#lib/assets/gotv-logo.svg';
</script>

<a
	class="home-link"
	href={resolve('/')}
	aria-label={t('app.layout.home')}
	title={t('app.layout.home')}
>
	<img src={logo} alt="" width="26" height="26" />
</a>

<style>
	.home-link {
		display: inline-flex;
		flex: none;
		align-items: center;
		border-radius: var(--radius-s);
	}

	.home-link img {
		display: block;
		width: 26px;
		height: 26px;
	}

	:global([data-design='oldschool']) .home-link img {
		width: 20px;
		height: 20px;
	}
</style>
