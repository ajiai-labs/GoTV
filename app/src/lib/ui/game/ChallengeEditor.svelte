<script lang="ts">
	// Creating a challenge, answering one and deciding on the proposals
	// received - as the old ChallengeEditor. The proposal lives here; the
	// ProposalForm shows it and reports changes. Two tabs once the challenge
	// exists: the proposal and the challenge's chat.
	import { untrack } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import type {
		Conversation,
		GameChannel,
		GameProposal,
		Index,
		Preferences,
		ProposalEditMode,
		ProposalVisibility,
		Room,
		User
	} from '#lib/model/types.ts';
	import {
		createInitialProposal,
		getEvenProposal,
		getOtherPlayerName
	} from '#lib/model/game/challenge.ts';
	import { getActionsForUser } from '#lib/model/game/tree.ts';
	import UnseenBadge from '#lib/ui/UnseenBadge.svelte';
	import ChatMessages from '#lib/ui/chat/ChatMessages.svelte';
	import ChatMessageBar from '#lib/ui/chat/ChatMessageBar.svelte';
	import ProposalForm from './ProposalForm.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		currentUser,
		challenge = null,
		initialRoomId,
		usersByName,
		roomsById,
		conversation = null,
		preferences,
		onCancel
	}: {
		currentUser: User;
		challenge?: GameChannel | null;
		initialRoomId: number | null | undefined;
		usersByName: Index<User>;
		roomsById: Index<Room>;
		conversation?: Conversation | null;
		preferences: Preferences;
		onCancel: () => unknown;
	} = $props();

	type EditorState = {
		proposal: GameProposal;
		visibility: ProposalVisibility;
		notes: string;
		roomId: number | null | undefined;
	};

	// Read once when the editor opens (as the old constructor did).
	function getInitialState(): EditorState {
		if (challenge) {
			const challengeProposal = challenge.sentProposal || challenge.initialProposal;
			if (!challengeProposal) throw new Error('No proposal in challenge');
			const creator = challenge.players.challengeCreator;
			// Our own challenge as it is; someone else's as an even proposal
			const proposal =
				creator && creator.name === currentUser.name
					? challengeProposal
					: getEvenProposal(challengeProposal, currentUser.name, usersByName);
			return {
				proposal,
				visibility: proposal.private ? 'private' : challenge.global ? 'public' : 'roomOnly',
				notes: challenge.name || '',
				roomId: challenge.roomId
			};
		}
		const lastProposal = preferences.lastProposal;
		return {
			proposal: createInitialProposal(currentUser, lastProposal ? lastProposal.proposal : null),
			visibility: lastProposal ? lastProposal.visibility : 'public',
			notes: lastProposal && lastProposal.notes ? lastProposal.notes : '',
			roomId: initialRoomId
		};
	}

	const initial = getInitialState();
	const initialProposal = initial.proposal;
	let proposal: GameProposal = $state(initial.proposal);
	let visibility: ProposalVisibility = $state(initial.visibility);
	let notes = $state(initial.notes);
	let roomId = $state(initial.roomId);
	let selectedProposalIndex = $state(0);
	let activeTab: 'proposal' | 'chat' = $state('proposal');

	// Follow the challenge: the status of a proposal we sent, our challenge
	// arriving after "create", and our rank changing (new players' ranks
	// settle) - then handicap and colours of our answer are worked out anew.
	let hadChallenge = untrack(() => !!challenge);
	let prevRank = untrack(() => currentUser.rank);
	$effect(() => {
		const current = challenge;
		const rank = currentUser.rank;
		untrack(() => {
			let newProposal: GameProposal | undefined;
			const sentProposal = current?.sentProposal;
			if (sentProposal && sentProposal.status !== proposal.status) {
				newProposal = { ...proposal, status: sentProposal.status };
			} else if (current && current.initialProposal && !hadChallenge) {
				newProposal = { ...current.initialProposal, status: 'pending' };
			}
			if (current && rank !== prevRank) {
				const creator = current.players.challengeCreator;
				const base = newProposal || proposal;
				if (
					base.status !== 'pending' &&
					creator &&
					creator.name !== currentUser.name &&
					current.initialProposal
				) {
					const even = getEvenProposal(current.initialProposal, currentUser.name, usersByName);
					newProposal = {
						...base,
						rules: { ...base.rules, handicap: even.rules.handicap },
						players: even.players
					};
				}
			}
			hadChallenge = !!current;
			prevRank = rank;
			if (newProposal) proposal = newProposal;
		});
	});

	let creator = $derived(challenge ? challenge.players.challengeCreator : currentUser);
	let isCreator = $derived(!!creator && creator.name === currentUser.name);
	let status = $derived(proposal.status);
	let pending = $derived(status === 'pending');
	let room = $derived(roomId ? roomsById[roomId] : undefined);
	let userActions = $derived(
		challenge ? getActionsForUser(challenge.actions, currentUser.name) : {}
	);
	let receivedProposals = $derived(challenge?.receivedProposals ?? []);
	let proposalCount = $derived(receivedProposals.length);
	// A proposal can be withdrawn while we look at it.
	let proposalIndex = $derived(Math.max(0, Math.min(selectedProposalIndex, proposalCount - 1)));

	type View =
		| { kind: 'create' }
		| { kind: 'submit' }
		| { kind: 'decide'; challenger: string }
		| { kind: 'counter'; creator: string }
		| { kind: 'awaitChallengers' }
		| { kind: 'awaitResponse' };

	let view: {
		editMode: ProposalEditMode;
		editProposal: GameProposal;
		prevProposal: GameProposal | null;
		buttons: View;
	} = $derived.by(() => {
		if (!challenge && !pending) {
			return {
				editMode: 'creating',
				editProposal: proposal,
				prevProposal: null,
				buttons: { kind: 'create' }
			};
		}
		if (challenge?.counterProposal && !isCreator) {
			// The creator sent our proposal back with changed terms
			return {
				editMode: 'waiting',
				editProposal: challenge.counterProposal,
				prevProposal: challenge.sentProposal ?? proposal,
				buttons: { kind: 'counter', creator: creator?.name ?? '' }
			};
		}
		if (!pending && !isCreator) {
			return {
				editMode: 'negotiating',
				editProposal: proposal,
				prevProposal: initialProposal,
				buttons: { kind: 'submit' }
			};
		}
		if (userActions.CHALLENGE_SETUP || !challenge) {
			if (proposalCount) {
				// Creator deciding on the proposals received
				const editProposal = receivedProposals[proposalIndex];
				const challenger = getOtherPlayerName(editProposal, currentUser.name);
				if (challenger) {
					return {
						editMode: 'waiting',
						editProposal,
						prevProposal: getEvenProposal(initialProposal, challenger, usersByName),
						buttons: { kind: 'decide', challenger }
					};
				}
			}
			// Creator awaiting challengers
			return {
				editMode: 'waiting',
				editProposal: proposal,
				prevProposal: proposal,
				buttons: { kind: 'awaitChallengers' }
			};
		}
		// Proposal sent to the creator
		return {
			editMode: 'waiting',
			editProposal: proposal,
			prevProposal: initialProposal,
			buttons: { kind: 'awaitResponse' }
		};
	});

	function onCreateChallenge() {
		const created = proposal;
		if (!challenge) {
			// No app state for the challenge yet: mark it as sent here
			proposal = { ...created, status: 'pending' };
		}
		if (roomId) {
			app.actions.onCreateChallenge(created, roomId, visibility, notes);
		}
	}

	function onSubmitProposal() {
		if (challenge) app.actions.onSubmitChallengeProposal(challenge.id, proposal);
	}

	function selectedReceivedProposal(): GameProposal | undefined {
		return challenge?.receivedProposals?.[proposalIndex];
	}

	function onAcceptProposal() {
		const received = selectedReceivedProposal();
		if (challenge && received) app.actions.onAcceptChallengeProposal(challenge.id, received);
	}

	function onAcceptCounter() {
		const counter = challenge?.counterProposal;
		if (!challenge || !counter) return;
		proposal = { ...counter, status: 'pending' };
		app.actions.onAcceptCounterProposal(challenge.id);
	}

	function onDeclineProposal() {
		const received = selectedReceivedProposal();
		if (!challenge || !received) return;
		const otherName = getOtherPlayerName(received, currentUser.name);
		if (otherName) {
			app.actions.onDeclineChallengeProposal(challenge.id, otherName);
			selectedProposalIndex = 0;
		}
	}

	function selectTab(tab: 'proposal' | 'chat') {
		if (tab === 'chat' && challenge) app.actions.markConversationSeen(challenge.id);
		activeTab = tab;
	}

	function onTabKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const next = activeTab === 'proposal' ? 'chat' : 'proposal';
		selectTab(next);
		document.getElementById(`ChallengeEditor-tab-${next}`)?.focus();
	}

	function onChat(body: string) {
		if (challenge) app.actions.onSendChat(body, challenge.id);
	}

	// The newest chat message stays in view.
	let chatBox: HTMLDivElement | undefined = $state();
	$effect(() => {
		void conversation?.messages.length;
		if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
	});
</script>

{#snippet proposalContent()}
	<div class="ChallengeEditor-proposal">
		{#if room}
			<ProposalForm
				{currentUser}
				editMode={view.editMode}
				proposal={view.editProposal}
				prevProposal={view.prevProposal}
				{visibility}
				{notes}
				{usersByName}
				{roomsById}
				{room}
				onUserDetail={(name: string) => app.actions.onUserDetail(name)}
				onChangeProposal={(p: GameProposal) => (proposal = p)}
				onChangeNotes={(n: string) => (notes = n)}
				onChangeRoomId={(id: number) => (roomId = id)}
				onChangeVisibility={(v: ProposalVisibility) => (visibility = v)}
			/>
		{:else}
			<p class="ChallengeEditor-noroom">
				{t('play.editor.noRoom')}
			</p>
		{/if}

		<div class="ChallengeEditor-buttons">
			{#if view.buttons.kind === 'create'}
				<button
					type="button"
					class="button button-primary"
					disabled={!room}
					onclick={onCreateChallenge}
				>
					{t('play.editor.create')}
				</button>
			{:else if view.buttons.kind === 'submit'}
				<button type="button" class="button button-primary" onclick={onSubmitProposal}>
					{t('play.editor.submit')}
				</button>
			{:else if view.buttons.kind === 'counter'}
				<p class="ChallengeEditor-counter" role="status">
					{t('play.editor.counter', { name: view.buttons.creator })}
				</p>
				<button type="button" class="button button-primary" onclick={onAcceptCounter}>
					{t('play.editor.accept')}
				</button>
				<button type="button" class="button button-danger" onclick={() => onCancel()}>
					{t('play.editor.decline')}
				</button>
			{:else if view.buttons.kind === 'decide'}
				<button type="button" class="button button-primary" onclick={onAcceptProposal}>
					{t('play.editor.accept')}
				</button>
				<button type="button" class="button button-danger" onclick={onDeclineProposal}>
					{t('play.editor.decline')}
				</button>
			{:else}
				<button type="button" class="button button-primary button-waiting" disabled>
					<span class="loading" aria-hidden="true"></span>
					{view.buttons.kind === 'awaitChallengers'
						? t('play.editor.awaitChallengers')
						: t('play.editor.awaitResponse')}
				</button>
			{/if}
			{#if view.editMode === 'creating' || view.editMode === 'negotiating'}
				<button type="button" class="button" onclick={() => onCancel()}>
					{t('play.editor.cancel')}
				</button>
			{/if}

			{#if proposalCount > 1}
				<div class="ChallengeEditor-prevnext">
					<button
						type="button"
						class="button ChallengeEditor-prevnext-button"
						aria-label={t('play.editor.previous')}
						disabled={proposalIndex === 0}
						onclick={() => (selectedProposalIndex = proposalIndex - 1)}
					>
						‹
					</button>
					<button
						type="button"
						class="button ChallengeEditor-prevnext-button"
						aria-label={t('play.editor.next')}
						disabled={proposalIndex === proposalCount - 1}
						onclick={() => (selectedProposalIndex = proposalIndex + 1)}
					>
						›
					</button>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<div class="ChallengeEditor">
	{#if status === 'declined'}
		<p class="ChallengeEditor-declined" role="status">{t('play.editor.declined')}</p>
	{/if}
	{#if status === 'accepted'}
		<p class="ChallengeEditor-accepted" role="status">{t('play.editor.accepted')}</p>
	{/if}

	{#if view.editMode !== 'creating'}
		<div class="ChallengeEditor-tabs" role="tablist" aria-label={t('play.editor.tabs')}>
			<button
				type="button"
				role="tab"
				id="ChallengeEditor-tab-proposal"
				aria-selected={activeTab === 'proposal'}
				aria-controls="ChallengeEditor-panel"
				tabindex={activeTab === 'proposal' ? 0 : -1}
				class="ChallengeEditor-tab"
				onclick={() => selectTab('proposal')}
				onkeydown={onTabKey}
			>
				{t('play.editor.proposalTab')}
			</button>
			<button
				type="button"
				role="tab"
				id="ChallengeEditor-tab-chat"
				aria-selected={activeTab === 'chat'}
				aria-controls="ChallengeEditor-panel"
				tabindex={activeTab === 'chat' ? 0 : -1}
				class="ChallengeEditor-tab"
				onclick={() => selectTab('chat')}
				onkeydown={onTabKey}
			>
				{t('play.editor.chatTab')}
				<UnseenBadge major={conversation?.unseenCount || 0} />
			</button>
		</div>
		<div
			class="ChallengeEditor-panel"
			id="ChallengeEditor-panel"
			role="tabpanel"
			aria-labelledby="ChallengeEditor-tab-{activeTab}"
		>
			{#if activeTab === 'proposal'}
				{@render proposalContent()}
			{:else if conversation}
				<div class="ChallengeEditor-chat">
					<div class="ChallengeEditor-chat-messages" bind:this={chatBox}>
						<ChatMessages
							{currentUser}
							messages={conversation.messages}
							{usersByName}
							onUserDetail={(name: string) => app.actions.onUserDetail(name)}
						/>
					</div>
					<ChatMessageBar {conversation} onSubmit={onChat} />
				</div>
			{:else}
				<p class="muted ChallengeEditor-nochat">{t('play.editor.noChat')}</p>
			{/if}
		</div>
	{:else}
		{@render proposalContent()}
	{/if}
</div>

<style>
	.ChallengeEditor {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 4px;
	}

	.ChallengeEditor-counter {
		flex-basis: 100%;
		margin: 0;
	}

	.ChallengeEditor-declined,
	.ChallengeEditor-accepted {
		margin: 0;
		padding: 8px 12px;
		border-radius: var(--radius-s);
		font-weight: 650;
	}

	.ChallengeEditor-declined {
		background: var(--warn-bg, #fbe3c8);
		color: var(--warn-ink, #6b3a00);
	}

	.ChallengeEditor-accepted {
		background: var(--accent-soft);
		color: var(--ink);
	}

	.ChallengeEditor-tabs {
		display: flex;
		gap: 4px;
		border-bottom: 1px solid var(--rule);
	}

	.ChallengeEditor-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 6px 14px;
		border: 0;
		border-bottom: 3px solid transparent;
		background: none;
		color: var(--ink-soft);
		font-weight: 650;
		cursor: pointer;
	}

	.ChallengeEditor-tab[aria-selected='true'] {
		border-bottom-color: var(--accent);
		color: var(--ink);
	}

	.ChallengeEditor-proposal {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.ChallengeEditor-noroom {
		margin: 0;
		color: var(--ink-soft);
	}

	.ChallengeEditor-buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.ChallengeEditor-buttons .button {
		min-height: 40px;
	}

	.ChallengeEditor-buttons .button:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.button-danger {
		border-color: var(--danger, #b3261e);
		color: var(--danger, #b3261e);
	}

	.loading {
		width: 12px;
		height: 12px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.ChallengeEditor-prevnext {
		display: flex;
		gap: 6px;
		margin-left: auto;
	}

	.ChallengeEditor-prevnext-button {
		justify-content: center;
		min-width: 44px;
		font-size: 1.2rem;
		line-height: 1;
	}

	.ChallengeEditor-chat {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
	}

	.ChallengeEditor-chat-messages {
		height: min(240px, 40dvh);
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.ChallengeEditor-nochat {
		margin: 12px 0;
	}

	:global([data-design='oldschool']) .ChallengeEditor-tab {
		min-height: 28px;
		margin-bottom: -1px;
		padding: 3px 10px;
		border: 1px solid var(--rule);
		border-bottom: 0;
		background: var(--surface);
	}

	:global([data-design='oldschool']) .ChallengeEditor-tab[aria-selected='true'] {
		background: var(--surface-sunk);
		color: var(--ink);
	}

	:global([data-design='oldschool']) .ChallengeEditor-declined,
	:global([data-design='oldschool']) .ChallengeEditor-accepted {
		border: 1px solid var(--rule);
		border-radius: 0;
	}
</style>
