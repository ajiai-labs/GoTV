<script lang="ts">
	// "Neuen Raum erstellen" (CGoban, Räume menu). Players may only create
	// temporary rooms; KGS answers ROOM_CREATED or why not.
	import { app } from '#lib/app.svelte.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	let name = $state('');
	let description = $state('');
	let privateRoom = $state(false);
	let sent = $state(false);

	const RESULTS: Record<string, MessageKey> = {
		ROOM_CREATED: 'community.room.created',
		ROOM_CREATE_NAME_TAKEN: 'community.room.nameTaken',
		ROOM_CREATE_TOO_MANY_ROOMS: 'community.room.tooMany'
	};
	let result = $derived.by(() => {
		const type = app.state.communityResult?.type;
		return sent && type && RESULTS[type] ? RESULTS[type] : null;
	});

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;
		app.actions.onCreateRoom(name, description, privateRoom);
		sent = true;
	}
</script>

<form class="CreateRoomForm" onsubmit={onSubmit}>
	<p class="muted">{t('community.room.hint')}</p>
	<label>
		<span>{t('community.room.name')}</span>
		<input type="text" bind:value={name} maxlength="50" autocomplete="off" required />
	</label>
	<label>
		<span>{t('community.room.description')}</span>
		<textarea bind:value={description} maxlength="1000" rows="3"></textarea>
	</label>
	<label class="CreateRoomForm-check">
		<input type="checkbox" bind:checked={privateRoom} />
		<span>{t('community.room.private')}</span>
	</label>
	<div>
		<button type="submit" class="button button-primary">{t('community.room.create')}</button>
	</div>
	{#if result}
		<p class:error={result !== 'community.room.created'} role="status">{t(result)}</p>
	{/if}
</form>

<style>
	.CreateRoomForm {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 46ch;
	}

	.CreateRoomForm p {
		margin: 0;
	}

	.CreateRoomForm label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.CreateRoomForm .CreateRoomForm-check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}

	.error {
		color: #c0392b;
	}
</style>
