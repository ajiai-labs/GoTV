<script lang="ts">
	// Settings: the interface language and the design.
	import { DESIGNS, design } from '#lib/ui/design.svelte.ts';
	import { LANGUAGES, language, t } from '#lib/i18n/index.svelte.ts';
	import BackupPanel from '#lib/ui/tv/BackupPanel.svelte';

	// Fixed colours per option, so each card shows its own design whatever
	// is chosen right now.
	const SWATCH = {
		modern: { bg: '#eef1ec', ink: '#1d2421', board: '#ddb77a', accent: '#1f7a5c' },
		'modern-dark': { bg: '#121816', ink: '#e4ebe7', board: '#cfa86c', accent: '#3fb68b' },
		oldschool: { bg: '#d4d0c8', ink: '#000000', board: '#d9a54a', accent: '#1c3f7a' }
	} as const;
</script>

<svelte:head>
	<title>{t('settings.pageTitle')}</title>
</svelte:head>

<h1>{t('settings.title')}</h1>

<fieldset class="language">
	<legend>{t('settings.language')}</legend>
	<p class="muted">{t('settings.languageHint')}</p>
	<div class="languages">
		{#each LANGUAGES as option (option.id)}
			<label class="choice" class:chosen={language.current === option.id}>
				<input
					type="radio"
					name="language"
					value={option.id}
					checked={language.current === option.id}
					onchange={() => language.set(option.id)}
				/>
				<span class="name" lang={option.id}>{option.name}</span>
			</label>
		{/each}
	</div>
</fieldset>

<fieldset>
	<legend>{t('settings.design')}</legend>
	<p class="muted">{t('settings.designHint')}</p>
	<div class="choices">
		{#each DESIGNS as option (option.id)}
			{@const c = SWATCH[option.id]}
			<label class="choice" class:chosen={design.current === option.id}>
				<input
					type="radio"
					name="design"
					value={option.id}
					checked={design.current === option.id}
					onchange={() => design.set(option.id)}
				/>
				<span class="preview" style:background={c.bg} aria-hidden="true">
					<span class="mini-board" style:background={c.board}>
						<span class="mini-stone black" style:left="30%" style:top="34%"></span>
						<span class="mini-stone white" style:left="58%" style:top="58%"></span>
					</span>
					<span class="mini-bar" style:background={c.ink}></span>
					<span class="mini-button" style:background={c.accent}></span>
				</span>
				<span class="name">{t(option.name)}</span>
				<span class="muted">{t(option.description)}</span>
			</label>
		{/each}
	</div>
</fieldset>

<section class="data" aria-label={t('settings.myData')}>
	<BackupPanel />
</section>

<style>
	h1 {
		margin: 8px 0 20px;
		font-size: clamp(1.5rem, 2.6vw, 2.1rem);
		letter-spacing: -0.015em;
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		max-width: 760px;
	}

	legend {
		font-weight: 650;
		font-size: 1.15rem;
		padding: 0;
	}

	.language {
		margin-bottom: calc(var(--gap) * 1.6);
	}

	.languages {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap);
		margin-top: 12px;
	}

	.languages .choice {
		min-width: 160px;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--gap);
		margin-top: 12px;
	}

	.choice {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		border: 2px solid var(--rule);
		border-radius: var(--radius-m);
		background: var(--surface);
		cursor: pointer;
	}

	.choice.chosen {
		border-color: var(--accent);
	}

	.choice input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.choice:focus-within {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.name {
		font-weight: 650;
	}

	.preview {
		position: relative;
		display: block;
		height: 120px;
		border-radius: var(--radius-s);
		overflow: hidden;
	}

	.mini-board {
		position: absolute;
		right: 12px;
		top: 12px;
		bottom: 12px;
		aspect-ratio: 1;
		border-radius: 3px;
		background-image:
			linear-gradient(rgba(60, 40, 10, 0.55) 1px, transparent 1px),
			linear-gradient(90deg, rgba(60, 40, 10, 0.55) 1px, transparent 1px);
		background-size: 16px 16px;
		background-position: 7px 7px;
	}

	.mini-stone {
		position: absolute;
		width: 14px;
		height: 14px;
		border-radius: 50%;
	}

	.mini-stone.black {
		background: radial-gradient(circle at 35% 30%, #555, #000 70%);
	}

	.mini-stone.white {
		background: radial-gradient(circle at 35% 30%, #fff, #cfcabb 80%);
	}

	.mini-bar {
		position: absolute;
		left: 12px;
		top: 16px;
		width: 34%;
		height: 10px;
		border-radius: 2px;
	}

	.mini-button {
		position: absolute;
		left: 12px;
		bottom: 16px;
		width: 22%;
		height: 18px;
		border-radius: 9px;
	}

	.data {
		max-width: 760px;
		margin-top: calc(var(--gap) * 1.6);
	}

	:global([data-design='oldschool']) h1 {
		font-size: 16px;
		letter-spacing: 0;
	}

	:global([data-design='oldschool']) .choice {
		border-radius: 0;
	}
</style>
