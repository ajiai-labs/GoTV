<script lang="ts">
	// The platform's own chat next to a stream, through its official embed.
	// Like the player it loads only after a click (two-click solution).
	import type { StreamChatInfo } from '#lib/model/StreamChat.ts';

	let { chat, title }: { chat: StreamChatInfo; title: string } = $props();

	const PLATFORM_LABEL: Record<StreamChatInfo['platform'], string> = {
		youtube: 'YouTube',
		twitch: 'Twitch'
	};

	let open = $state(false);
	let label = $derived(PLATFORM_LABEL[chat.platform]);
</script>

<div class="StreamChat">
	<div class="StreamChat-bar">
		<button
			type="button"
			class="button StreamChat-toggle"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			{open ? label + '-Chat ausblenden' : label + '-Chat anzeigen'}
		</button>
		{#if !open}
			<span class="StreamChat-hint muted">
				lädt den Chat von {label}; schreiben nur mit {label}-Anmeldung
			</span>
		{/if}
	</div>
	{#if open}
		<iframe class="StreamChat-frame" src={chat.embedUrl} title={'Chat: ' + title}></iframe>
	{/if}
</div>

<style>
	.StreamChat {
		margin-top: 8px;
	}

	.StreamChat-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
	}

	.StreamChat-toggle {
		padding: 4px 12px;
		font-size: 0.9em;
	}

	.StreamChat-hint {
		font-size: 0.82em;
	}

	.StreamChat-frame {
		display: block;
		width: 100%;
		height: 420px;
		margin-top: 6px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
	}
</style>
