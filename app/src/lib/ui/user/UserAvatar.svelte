<script lang="ts">
	// A user's KGS avatar, or a silhouette when they have none. Fills its
	// parent; the parent sets the size.
	import type { User } from '#lib/model/types.ts';

	let { user }: { user: User | null | undefined } = $props();
</script>

<div class="UserAvatar">
	{#if user}
		{#if user.flags?.avatar}
			<img src="https://files.gokgs.com/avatars/{encodeURIComponent(user.name)}.jpg" alt="" />
		{:else}
			<svg class="UserAvatar-missing" viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="12" cy="8" r="4.2" />
				<path d="M3.5 21c0-4.6 3.8-7.6 8.5-7.6s8.5 3 8.5 7.6z" />
			</svg>
		{/if}
	{/if}
</div>

<style>
	.UserAvatar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: var(--radius-s);
		background: var(--surface-sunk);
	}

	img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.UserAvatar-missing {
		width: 60%;
		height: 60%;
		fill: var(--rule);
	}
</style>
