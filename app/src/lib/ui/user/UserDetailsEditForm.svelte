<script lang="ts">
	// Edit your own KGS profile: name, e-mail, new password, bio and three
	// switches. Saving hands the changed details (and a new password, if one
	// was typed) to onSave.
	import { untrack } from 'svelte';
	import type { User, UserDetails } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		user,
		details,
		onSave,
		onCancel
	}: {
		user: User;
		details: UserDetails;
		onSave: (user: User, details: UserDetails, newPassword: string) => unknown;
		onCancel: () => unknown;
	} = $props();

	// A working copy, taken once when the form opens (as in the old form).
	let draft: UserDetails = $state(
		untrack(() => ({
			...details,
			email: details.email ?? '',
			rankWanted: user.rank !== undefined && user.rank !== null
		}))
	);
	let newPassword = $state('');

	function save(event: SubmitEvent) {
		event.preventDefault();
		// No address before and none typed: leave the field out, as before.
		const email = draft.email === '' && details.email === undefined ? undefined : draft.email;
		onSave(user, { ...draft, email }, newPassword);
	}
</script>

<form class="UserDetailsEditForm" onsubmit={save}>
	<label>
		<span>{t('chat.edit.name')}</span>
		<input
			type="text"
			name="personalName"
			autocapitalize="words"
			autocomplete="name"
			bind:value={draft.personalName}
		/>
	</label>
	<label>
		<span>{t('chat.edit.email')}</span>
		<input type="email" name="email" autocomplete="email" bind:value={draft.email} />
	</label>
	<label>
		<span>{t('chat.edit.newPassword')}</span>
		<input
			type="password"
			name="newPassword"
			autocomplete="new-password"
			placeholder={t('chat.edit.newPasswordHint')}
			bind:value={newPassword}
		/>
	</label>
	<label>
		<span>{t('chat.edit.about')}</span>
		<textarea name="personalInfo" rows="5" bind:value={draft.personalInfo}></textarea>
	</label>
	<label class="check">
		<input type="checkbox" name="emailWanted" bind:checked={draft.emailWanted} />
		<span>{t('chat.edit.emailWanted')}</span>
	</label>
	<label class="check">
		<input type="checkbox" name="privateEmail" bind:checked={draft.privateEmail} />
		<span>{t('chat.edit.privateEmail')}</span>
	</label>
	<label class="check">
		<input type="checkbox" name="rankWanted" bind:checked={draft.rankWanted} />
		<span>{t('chat.edit.rankWanted')}</span>
	</label>
	<div class="buttons">
		<button class="button button-primary" type="submit">{t('chat.edit.save')}</button>
		<button class="button" type="button" onclick={() => onCancel()}>{t('chat.edit.cancel')}</button>
	</div>
</form>

<style>
	.UserDetailsEditForm {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 8px;
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
	input[type='email'],
	input[type='password'],
	textarea {
		font: inherit;
		padding: 9px 12px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
	}

	textarea {
		resize: vertical;
	}

	.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}

	.check span {
		color: var(--ink);
		font-size: 1em;
	}

	.check input {
		width: 18px;
		height: 18px;
		flex: none;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 4px;
	}

	:global([data-design='oldschool']) .UserDetailsEditForm input[type='text'],
	:global([data-design='oldschool']) .UserDetailsEditForm input[type='email'],
	:global([data-design='oldschool']) .UserDetailsEditForm input[type='password'],
	:global([data-design='oldschool']) .UserDetailsEditForm textarea {
		padding: 3px 5px;
		border: 2px inset var(--bevel-face, #ece9e2);
		background: var(--surface-sunk);
	}
</style>
