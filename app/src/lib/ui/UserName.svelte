<script lang="ts">
	// A KGS user as in the old app: name [rank] plus robot, guest, "selfish"
	// and (with extraIcons) admin, KGS+, sleeping and tournament icons.
	import type { User } from '#lib/model/types.ts';

	let {
		user,
		extraIcons = false
	}: {
		user: User | null | undefined;
		extraIcons?: boolean;
	} = $props();

	let flags = $derived(user?.flags ?? {});
	let extra = $derived.by(() => {
		if (!user || !extraIcons) return [];
		const icons: Array<string> = [];
		if (user.authLevel === 'jr_admin') icons.push('⭐️');
		else if (user.authLevel === 'sr_admin' || user.authLevel === 'super_admin') icons.push('🌟');
		if (flags.sleeping) icons.push('💤');
		if (flags.kgsPlus) icons.push('🎩');
		if (flags.tourneyWinner || flags.kgsMeijin) icons.push('🏆');
		if (flags.tourneyRunnerUp) icons.push('🏅');
		return icons;
	});
</script>

{#if user}
	<span class="user">
		{user.name}{#if !flags.guest}<span class="rank">
				[{user.rank || '-'}]
			</span>{/if}{#if flags.robot}<span title="Bot"> 🤖</span>{/if}{#if flags.selfish}<span
				class="selfish"
				title="spielt keine Partien gegen Unbekannte"
			>
				~
			</span>{/if}{#if flags.guest}<span title="Gast">
				👤
			</span>{/if}{#each extra as icon (icon)}<span> {icon}</span>{/each}
	</span>
{:else}
	<span class="user unknown">[unbekannt]</span>
{/if}

<style>
	.user {
		white-space: nowrap;
	}

	.rank {
		color: var(--ink-soft);
	}

	.selfish {
		margin-left: 2px;
		color: var(--ink-soft);
	}

	.unknown {
		color: var(--ink-soft);
	}
</style>
