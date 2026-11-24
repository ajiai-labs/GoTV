<script lang="ts">
	// Says what still works without a connection: replaying (also tournament
	// games opened before) and KataGo; streams and live boards need the
	// network.
	let offline = $state(typeof navigator !== 'undefined' && navigator.onLine === false);

	function update() {
		offline = navigator.onLine === false;
	}
</script>

<svelte:window ononline={update} onoffline={update} />

{#if offline}
	<p class="OfflineNotice" role="status">
		Offline · Nachspielen und KataGo gehen weiter, auch schon geöffnete Turnierpartien. Streams,
		Live-Bretter und neue Kalenderdaten brauchen Internet.
	</p>
{/if}

<style>
	.OfflineNotice {
		margin: 0 0 var(--gap);
		padding: 10px 14px;
		border-left: 4px solid #c8962b;
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
	}

	:global([data-design='oldschool']) .OfflineNotice {
		border: 2px solid;
		border-color: #ffffff #808080 #808080 #ffffff;
		border-left: 4px solid #c8962b;
		background: #ffffe1;
	}
</style>
