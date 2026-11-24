<script lang="ts">
	// Web version on iPad and iPhone: a small hint how to put GoTV on the home
	// screen (Teilen -> "Zum Home-Bildschirm"), shown in Safari while GoTV does
	// not run from the home screen yet. Closed once, it stays closed on this
	// device (gotv.homeHintDismissed).
	import { onMount } from 'svelte';
	import logo from '#lib/assets/gotv-logo.svg';
	import { config } from '#lib/config.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import {
		getDeviceInfo,
		loadHomeHintDismissed,
		saveHomeHintDismissed,
		shouldShowHomeHint
	} from '#lib/util/homeScreen.ts';
	import type { DeviceInfo } from '#lib/util/homeScreen.ts';

	let {
		guestOnly = config.guestOnly,
		device
	}: {
		// Defaults: the build (web version only) and this browser.
		guestOnly?: boolean;
		device?: DeviceInfo;
	} = $props();

	const uid = $props.id();
	let visible = $state(false);

	onMount(() => {
		visible = shouldShowHomeHint(device ?? getDeviceInfo(), guestOnly, loadHomeHintDismissed());
	});

	function onClose() {
		saveHomeHintDismissed();
		visible = false;
	}

	// The text names the Share button; its icon sits where "{icon}" stands.
	let parts = $derived(t('app.homeHint.text').split('{icon}'));
</script>

{#if visible}
	<aside class="HomeScreenHint panel" aria-labelledby="{uid}-title">
		<img class="HomeScreenHint-logo" src={logo} alt="" width="40" height="40" />
		<div class="HomeScreenHint-body">
			<h2 id="{uid}-title" class="HomeScreenHint-title">{t('app.homeHint.title')}</h2>
			<p class="HomeScreenHint-text">
				{parts[0]}<svg
					class="HomeScreenHint-share"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					aria-hidden="true"
				>
					<path
						d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>{parts[1] ?? ''}
			</p>
		</div>
		<button
			type="button"
			class="HomeScreenHint-close"
			aria-label={t('app.homeHint.close')}
			title={t('app.homeHint.close')}
			onclick={onClose}
		>
			×
		</button>
	</aside>
{/if}

<style>
	.HomeScreenHint {
		position: fixed;
		left: 50%;
		bottom: max(16px, env(safe-area-inset-bottom));
		z-index: 40;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: min(calc(100% - 32px), 440px);
		padding: 12px 8px 12px 14px;
		transform: translateX(-50%);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
	}

	.HomeScreenHint-logo {
		flex: none;
		width: 40px;
		height: 40px;
	}

	.HomeScreenHint-body {
		flex: 1;
		min-width: 0;
	}

	.HomeScreenHint-title {
		margin: 0 0 2px;
		font-size: 1em;
		font-weight: 700;
	}

	.HomeScreenHint-text {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.92em;
		line-height: 1.4;
	}

	.HomeScreenHint-share {
		display: inline-block;
		margin: 0 2px;
		color: var(--accent);
		vertical-align: -3px;
	}

	.HomeScreenHint-close {
		flex: none;
		min-width: 40px;
		min-height: 40px;
		margin: -6px 0 0;
		border: 0;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--ink-soft);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}

	.HomeScreenHint-close:hover {
		color: var(--ink);
	}

	:global([data-design='oldschool']) .HomeScreenHint {
		border-radius: 0;
		box-shadow: 2px 2px 0 #808080;
	}

	:global([data-design='oldschool']) .HomeScreenHint-close {
		border-radius: 0;
	}
</style>
