<script lang="ts" module>
	import type { GameRuleSet, GameType } from '#lib/model/types.ts';

	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { CHALLENGE_TEXT_MAX } from '#lib/model/kgsLimits.ts';

	const GAME_TYPE_KEYS: Record<GameType, MessageKey> = {
		challenge: 'play.gameType.challenge',
		demonstration: 'play.gameType.demonstration',
		review: 'play.gameType.review',
		rengo_review: 'play.gameType.rengoReview',
		teaching: 'play.gameType.teaching',
		simul: 'play.gameType.simul',
		rengo: 'play.gameType.rengo',
		free: 'play.gameType.free',
		ranked: 'play.gameType.ranked',
		tournament: 'play.gameType.tournament'
	};

	const RULESET_KEYS: Record<GameRuleSet, MessageKey> = {
		japanese: 'play.ruleset.japanese',
		chinese: 'play.ruleset.chinese',
		aga: 'play.ruleset.aga',
		new_zealand: 'play.ruleset.newZealand'
	};

	// formatGameType / formatGameRuleset (taken over
	// unchanged) speak English; the new interface shows the current language.
	export function formatGameTypeDe(type: GameType): string {
		const key = GAME_TYPE_KEYS[type];
		return key ? t(key) : type;
	}

	export function formatGameRulesetDe(ruleset: GameRuleSet): string {
		const key = RULESET_KEYS[ruleset];
		return key ? t(key) : ruleset;
	}
</script>

<script lang="ts">
	// The form of a challenge proposal. Three modes, as in the old app:
	// "creating" - a new challenge: room, note, type, visibility, time, rules
	//   and board size can be set;
	// "negotiating" - answering someone's challenge: the players (colours
	//   can be swapped by clicking them), handicap and komi can be set;
	// "waiting" - read only (proposal sent, or proposals received).
	// The form only reports changes; the ChallengeEditor keeps the proposal.
	import type {
		GameProposal,
		GameRules,
		Index,
		ProposalEditMode,
		ProposalVisibility,
		Room,
		User
	} from '#lib/model/types.ts';
	import { formatDuration } from '#lib/model/game/display.ts';
	import GameTypeIcon from './GameTypeIcon.svelte';
	import GameTimeSystem from './GameTimeSystem.svelte';
	import ProposalPlayers from './ProposalPlayers.svelte';
	import ProposalFormInput from './ProposalFormInput.svelte';
	import { language } from '#lib/i18n/index.svelte.ts';

	let {
		currentUser,
		editMode,
		proposal,
		prevProposal = null,
		notes,
		visibility,
		usersByName,
		roomsById,
		room,
		onUserDetail,
		onChangeProposal,
		onChangeNotes,
		onChangeVisibility,
		onChangeRoomId
	}: {
		currentUser: User;
		editMode: ProposalEditMode;
		proposal: GameProposal;
		prevProposal?: GameProposal | null;
		notes: string;
		visibility: ProposalVisibility;
		usersByName: Index<User>;
		roomsById: Index<Room>;
		room: Room;
		onUserDetail: (name: string) => unknown;
		onChangeProposal: (proposal: GameProposal) => unknown;
		onChangeNotes: (notes: string) => unknown;
		onChangeVisibility: (visibility: ProposalVisibility) => unknown;
		onChangeRoomId: (roomId: number) => unknown;
	} = $props();

	const visibilityOptions: Array<{ value: ProposalVisibility; label: MessageKey }> = [
		{ value: 'private', label: 'play.visibility.private' },
		{ value: 'roomOnly', label: 'play.visibility.roomOnly' },
		{ value: 'public', label: 'play.visibility.public' }
	];

	const gameTypeOptions: Array<{ value: GameType; label: MessageKey }> = [
		{ value: 'ranked', label: 'play.gameType.ranked' },
		{ value: 'free', label: 'play.gameType.free' }
	];

	const rulesetOptions: Array<{ value: GameRuleSet; label: MessageKey }> = [
		{ value: 'japanese', label: RULESET_KEYS.japanese },
		{ value: 'chinese', label: RULESET_KEYS.chinese },
		{ value: 'aga', label: RULESET_KEYS.aga },
		{ value: 'new_zealand', label: RULESET_KEYS.new_zealand }
	];

	type TimeSystem = NonNullable<GameRules['timeSystem']>;
	const timeSystemOptions: Array<{ value: TimeSystem; label: MessageKey }> = [
		{ value: 'none', label: 'play.timeSystem.none' },
		{ value: 'absolute', label: 'play.timeSystem.absolute' },
		{ value: 'byo_yomi', label: 'play.timeSystem.byoYomi' },
		{ value: 'canadian', label: 'play.timeSystem.canadian' }
	];

	const sizeOptions = [9, 13, 19];

	let creating = $derived(editMode === 'creating');
	let rules = $derived(proposal.rules);
	let ruleset = $derived(rules.rules || 'japanese');
	let handiKomiReadonly = $derived(editMode === 'waiting' || proposal.nigiri);

	// Rooms with a name, the fullest first, then by name.
	let rooms = $derived(
		Object.values(roomsById)
			.filter((r) => r.name)
			.sort(
				(a, b) =>
					(b.users ? b.users.length : 0) - (a.users ? a.users.length : 0) ||
					(a.name ? a.name.localeCompare(b.name || '') : 0)
			)
	);

	function setRules(changes: Partial<GameRules>) {
		onChangeProposal({ ...proposal, rules: { ...proposal.rules, ...changes } });
	}

	function changeVisibility(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value as ProposalVisibility;
		if (value === 'private') {
			onChangeProposal({ ...proposal, gameType: 'free' });
		}
		onChangeVisibility(value);
	}

	function changeGameType(e: Event) {
		const gameType = (e.currentTarget as HTMLSelectElement).value as GameType;
		if (gameType === 'ranked' && visibility === 'private') {
			onChangeVisibility('public');
		}
		onChangeProposal({ ...proposal, gameType });
	}

	function changeRuleset(e: Event) {
		setRules({ rules: (e.currentTarget as HTMLSelectElement).value as GameRuleSet });
	}

	function changeTimeSystem(e: Event) {
		const timeSystem = (e.currentTarget as HTMLSelectElement).value as TimeSystem;
		const changes: Partial<GameRules> = { timeSystem };
		if (timeSystem === 'canadian') {
			changes.byoYomiStones = 25;
			changes.byoYomiTime = 7 * 60;
		} else if (timeSystem === 'byo_yomi') {
			changes.byoYomiTime = 30;
			changes.byoYomiPeriods = 5;
		}
		setRules(changes);
	}

	// Click on a player's colour while negotiating: white -> black,
	// black -> nigiri (handicap 0), nigiri -> the colours as before nigiri.
	function toggleRole(name: string) {
		if (editMode !== 'negotiating' || proposal.players.length !== 2) return;
		const thisPlayerOld = proposal.players.find((p) => p.name === name);
		const otherPlayerOld = proposal.players.find((p) => p.name !== name);
		if (!thisPlayerOld || !otherPlayerOld) return;
		const thisPlayer = { ...thisPlayerOld };
		const otherPlayer = { ...otherPlayerOld };
		const newProposal = { ...proposal };
		if (proposal.nigiri) {
			newProposal.nigiri = false;
		} else if (thisPlayer.role === 'white') {
			thisPlayer.role = 'black';
			otherPlayer.role = 'white';
		} else if (thisPlayer.role === 'black') {
			newProposal.nigiri = true;
			newProposal.rules = { ...newProposal.rules, handicap: 0 };
			thisPlayer.role = 'white';
			otherPlayer.role = 'black';
		}
		// Keep the order of the players for the KGS API
		newProposal.players = proposal.players.map((p) =>
			p.name === thisPlayer.name ? thisPlayer : otherPlayer
		);
		onChangeProposal(newProposal);
	}

	function stepSize(step: -1 | 1) {
		let idx = sizeOptions.indexOf(proposal.rules.size);
		if (step < 0 && idx > 0) idx--;
		if (step > 0 && idx < sizeOptions.length - 1) idx++;
		setRules({ size: sizeOptions[idx] });
	}

	function handiMinus() {
		const oldHandi = proposal.rules.handicap || 0;
		setRules({ handicap: oldHandi <= 2 ? 0 : oldHandi - 1 });
	}

	function handiPlus() {
		const oldHandi = proposal.rules.handicap || 0;
		setRules({ handicap: oldHandi <= 1 ? 2 : Math.min(9, oldHandi + 1) });
	}

	const KOMI_DOWN: Record<string, number> = { '10.5': 7.5, '7.5': 6.5, '6.5': 0.5, '0.5': -5.5 };
	const KOMI_UP: Record<string, number> = { '-5.5': 0.5, '0.5': 6.5, '6.5': 7.5, '7.5': 10.5 };

	function komiMinus() {
		const oldKomi = proposal.rules.komi;
		setRules({ komi: KOMI_DOWN[String(oldKomi)] ?? oldKomi - 5 });
	}

	function komiPlus() {
		const oldKomi = proposal.rules.komi;
		setRules({ komi: KOMI_UP[String(oldKomi)] ?? oldKomi + 5 });
	}

	function mainTimeMinus() {
		const oldMainTime = proposal.rules.mainTime || 0;
		setRules({ mainTime: oldMainTime === 5 * 60 ? 60 : Math.max(0, oldMainTime - 5 * 60) });
	}

	function mainTimePlus() {
		const oldMainTime = proposal.rules.mainTime || 0;
		const mainTime = oldMainTime === 0 ? 60 : oldMainTime === 60 ? 5 * 60 : oldMainTime + 5 * 60;
		setRules({ mainTime });
	}

	function byoYomiMinus() {
		const old = proposal.rules.byoYomiTime || 0;
		const step = old <= 20 ? 5 : old <= 60 ? 10 : 60;
		setRules({ byoYomiTime: Math.max(5, old - step) });
	}

	function byoYomiPlus() {
		// The mirror of byoYomiMinus (the old app compared the new value
		// here by mistake, so it always stepped by 5 below a minute).
		const old = proposal.rules.byoYomiTime || 0;
		const step = old >= 60 ? 60 : old >= 20 ? 10 : 5;
		setRules({ byoYomiTime: old + step });
	}

	function periodsStep(step: -1 | 1) {
		const periods = (proposal.rules.byoYomiPeriods || 5) + step;
		setRules({ byoYomiPeriods: Math.min(100, Math.max(1, periods)) });
	}

	function stonesStep(step: -5 | 5) {
		const stones = (proposal.rules.byoYomiStones || 25) + step;
		setRules({ byoYomiStones: Math.min(100, Math.max(5, stones)) });
	}
</script>

<div class="ProposalForm" class:ProposalForm-creating={creating}>
	{#if !creating}
		<div class="ProposalForm-players">
			<ProposalPlayers
				{currentUser}
				players={proposal.players}
				prevPlayers={prevProposal ? prevProposal.players : null}
				nigiri={proposal.nigiri}
				prevNigiri={prevProposal ? prevProposal.nigiri : null}
				{usersByName}
				{onUserDetail}
				onToggleRole={toggleRole}
			/>
			{#if editMode === 'negotiating'}
				<p class="ProposalForm-hint muted">{t('play.form.toggleHint')}</p>
			{/if}
		</div>

		<div class="ProposalForm-summary">
			<div class="ProposalForm-type-room">{room.name}</div>
			<div class="ProposalForm-type-notes">
				<GameTypeIcon type={proposal.gameType} />
				<span
					class="ProposalForm-game-type-name"
					class:ProposalForm-game-type-name-hilite={!!prevProposal &&
						prevProposal.gameType !== proposal.gameType}
				>
					{visibility === 'private' ? t('play.visibility.private') + ' · ' : ''}{formatGameTypeDe(
						proposal.gameType
					)}
				</span>
				{#if notes}<span class="ProposalForm-notes">– {notes}</span>{/if}
			</div>
		</div>

		<div class="ProposalForm-rules-time">
			<dl class="ProposalForm-rules-readonly">
				<div class="ProposalForm-field">
					<dt class="ProposalForm-field-label">{t('play.form.time')}</dt>
					<dd class="ProposalForm-field-content"><GameTimeSystem {rules} /></dd>
				</div>
				{#if rules.rules}
					<div class="ProposalForm-field">
						<dt class="ProposalForm-field-label">{t('play.form.rules')}</dt>
						<dd class="ProposalForm-field-content">{formatGameRulesetDe(rules.rules)}</dd>
					</div>
				{/if}
				<div class="ProposalForm-field">
					<dt class="ProposalForm-field-label">{t('play.form.board')}</dt>
					<dd class="ProposalForm-field-content">{rules.size}×{rules.size}</dd>
				</div>
			</dl>
			<div class="ProposalForm-handicap-komi">
				<ProposalFormInput
					value={rules.handicap || 0}
					label={t('play.form.handicap')}
					readonly={handiKomiReadonly}
					hilited={prevProposal
						? (prevProposal.rules.handicap || 0) !== (rules.handicap || 0)
						: false}
					onMinus={handiMinus}
					onPlus={handiPlus}
				/>
				<ProposalFormInput
					value={language.current === 'de'
						? String(rules.komi).replace('.', ',')
						: String(rules.komi)}
					label={t('play.form.komi')}
					readonly={handiKomiReadonly}
					hilited={prevProposal ? prevProposal.rules.komi !== rules.komi : false}
					onMinus={komiMinus}
					onPlus={komiPlus}
				/>
			</div>
		</div>
	{:else}
		<div class="ProposalForm-grid">
			<label class="ProposalForm-field">
				<span class="ProposalForm-field-label">{t('play.form.room')}</span>
				<select value={room.id} onchange={(e) => onChangeRoomId(Number(e.currentTarget.value))}>
					{#each rooms as r (r.id)}
						<option value={r.id}>{r.name}</option>
					{/each}
				</select>
			</label>

			<label class="ProposalForm-field">
				<span class="ProposalForm-field-label">{t('play.form.note')}</span>
				<input
					type="text"
					placeholder={t('play.form.notePlaceholder')}
					maxlength={CHALLENGE_TEXT_MAX}
					value={notes}
					oninput={(e) => onChangeNotes(e.currentTarget.value)}
				/>
			</label>

			<label class="ProposalForm-field">
				<span class="ProposalForm-field-label">{t('play.form.gameType')}</span>
				<select value={proposal.gameType} onchange={changeGameType}>
					{#each gameTypeOptions as opt (opt.value)}
						<option value={opt.value}>{t(opt.label)}</option>
					{/each}
				</select>
			</label>

			<label class="ProposalForm-field">
				<span class="ProposalForm-field-label">{t('play.form.visibility')}</span>
				<select value={visibility} onchange={changeVisibility}>
					{#each visibilityOptions as opt (opt.value)}
						<option value={opt.value}>{t(opt.label)}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="ProposalForm-rules-time">
			<div class="ProposalForm-time">
				<label class="ProposalForm-field">
					<span class="ProposalForm-field-label">{t('play.form.time')}</span>
					<select value={rules.timeSystem} onchange={changeTimeSystem}>
						{#each timeSystemOptions as opt (opt.value)}
							<option value={opt.value}>{t(opt.label)}</option>
						{/each}
					</select>
				</label>
				{#if rules.timeSystem !== 'none'}
					<ProposalFormInput
						value={formatDuration(rules.mainTime || 0)}
						label={t('play.form.mainTime')}
						onMinus={mainTimeMinus}
						onPlus={mainTimePlus}
					/>
				{/if}
				{#if rules.timeSystem === 'byo_yomi' || rules.timeSystem === 'canadian'}
					<ProposalFormInput
						value={formatDuration(rules.byoYomiTime || 0)}
						label={t('play.timeSystem.byoYomi')}
						onMinus={byoYomiMinus}
						onPlus={byoYomiPlus}
					/>
				{/if}
				{#if rules.timeSystem === 'byo_yomi'}
					<ProposalFormInput
						value={rules.byoYomiPeriods || 0}
						label={t('play.form.periods')}
						onMinus={() => periodsStep(-1)}
						onPlus={() => periodsStep(1)}
					/>
				{/if}
				{#if rules.timeSystem === 'canadian'}
					<ProposalFormInput
						value={rules.byoYomiStones || 0}
						label={t('play.form.stones')}
						onMinus={() => stonesStep(-5)}
						onPlus={() => stonesStep(5)}
					/>
				{/if}
			</div>
			<div class="ProposalForm-rules">
				<label class="ProposalForm-field">
					<span class="ProposalForm-field-label">{t('play.form.rules')}</span>
					<select value={ruleset} onchange={changeRuleset}>
						{#each rulesetOptions as opt (opt.value)}
							<option value={opt.value}>{t(opt.label)}</option>
						{/each}
					</select>
				</label>
				<ProposalFormInput
					value="{rules.size}×{rules.size}"
					label={t('play.form.board')}
					onMinus={() => stepSize(-1)}
					onPlus={() => stepSize(1)}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.ProposalForm {
		display: flex;
		flex-direction: column;
		gap: 14px;
		color: var(--ink);
	}

	.ProposalForm-hint {
		margin: 6px 0 0;
		font-size: 0.88em;
	}

	.ProposalForm-summary {
		padding-bottom: 10px;
		border-bottom: 1px solid var(--rule);
	}

	.ProposalForm-type-room {
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	.ProposalForm-type-notes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		margin-top: 4px;
	}

	.ProposalForm-game-type-name {
		font-weight: 650;
	}

	.ProposalForm-game-type-name-hilite {
		padding: 1px 6px;
		border-radius: var(--radius-s);
		background: var(--warn-bg, #fff1a9);
		color: var(--paper-ink, #1d2421);
	}

	.ProposalForm-notes {
		color: var(--ink-soft);
	}

	.ProposalForm-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.ProposalForm-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		margin: 0;
	}

	.ProposalForm-field-label {
		font-size: 0.88em;
		font-weight: 650;
		color: var(--ink-soft);
	}

	.ProposalForm select,
	.ProposalForm input {
		width: 100%;
		min-height: 40px;
		padding: 6px 10px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		/* 16px keeps iOS Safari from zooming in on focus */
		font-size: max(16px, 1em);
	}

	.ProposalForm select:focus,
	.ProposalForm input:focus {
		border-color: var(--accent);
		outline: 2px solid var(--accent-soft);
		outline-offset: 0;
	}

	.ProposalForm-rules-time {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px 20px;
	}

	.ProposalForm-time,
	.ProposalForm-rules,
	.ProposalForm-handicap-komi {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.ProposalForm-rules-readonly {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
	}

	.ProposalForm-rules-readonly .ProposalForm-field {
		flex-direction: row;
		align-items: baseline;
		gap: 10px;
	}

	.ProposalForm-rules-readonly .ProposalForm-field-label {
		width: 52px;
		flex: none;
	}

	.ProposalForm-rules-readonly dd {
		margin: 0;
	}

	@media (max-width: 520px) {
		.ProposalForm-grid,
		.ProposalForm-rules-time {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	:global([data-design='oldschool']) .ProposalForm select,
	:global([data-design='oldschool']) .ProposalForm input {
		min-height: 28px;
		padding: 2px 4px;
		border: 2px inset var(--bevel-face, #ece9e2);
		border-radius: 0;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .ProposalForm-field-label {
		color: var(--ink);
	}
</style>
