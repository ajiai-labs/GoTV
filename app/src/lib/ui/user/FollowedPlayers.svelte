<script lang="ts">
	// "Gefolgte Spieler" on Live and Beobachten: who of the followed KGS players
	// plays right now, with a way to watch the game.
	import { app } from '#lib/app.svelte.ts';
	import { getFollowedGames } from '#lib/model/FollowedPlayers.ts';
	import { followed } from './followed.svelte.ts';

	let loggedIn = $derived(!!app.state.currentUser);
	let games = $derived(getFollowedGames(app.state.activeGames, followed.names));

	function gameOf(name: string) {
		return games.find((item) => item.name.toLowerCase() === name.toLowerCase()) ?? null;
	}
</script>

<section class="followed panel" aria-labelledby="followed-title">
	<h2 id="followed-title" class="panel-title">Gefolgte Spieler</h2>
	<div class="body">
		{#if !followed.names.length}
			<p class="muted">
				Folge Spielern auf KGS: Namen anklicken und im Profil „Folgen“ wählen. Dann siehst du hier,
				wer gerade spielt.
			</p>
		{:else}
			{#if !loggedIn}
				<p class="muted">Bei KGS anmelden, um zu sehen, wer gerade spielt.</p>
			{/if}
			<ul>
				{#each followed.names as name (name)}
					{@const item = loggedIn ? gameOf(name) : null}
					<li>
						<button
							type="button"
							class="star"
							aria-label="{name} nicht mehr folgen"
							title="Nicht mehr folgen"
							onclick={() => followed.toggle(name)}
						>
							★
						</button>
						<span class="name">{item?.name ?? name}</span>
						{#if item}
							<span class="status live">
								spielt gegen {item.opponent?.name ?? '?'}{item.opponent?.rank
									? ` [${item.opponent.rank}]`
									: ''}{item.game.moveNum ? ` · Zug ${item.game.moveNum}` : ''}
							</span>
							<button
								type="button"
								class="button button-primary"
								onclick={() => app.actions.onJoinGame(item.game.id)}
							>
								Ansehen
							</button>
						{:else if loggedIn}
							<span class="status muted">gerade keine Partie</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="hint muted">
				Beginnt ein gefolgter Spieler eine Partie, meldet GoTV das, solange es offen ist und die
				Erinnerungen unter „Mein GoTV“ eingeschaltet sind.
			</p>
		{/if}
	</div>
</section>

<style>
	.body {
		padding: 4px 16px 14px;
	}

	.body p {
		margin: 6px 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--rule);
	}

	.star {
		border: 0;
		background: none;
		color: #c8962b;
		font-size: 1.2rem;
		padding: 2px 4px;
		cursor: pointer;
	}

	.name {
		font-weight: 650;
	}

	.status {
		flex: 1 1 160px;
		font-size: 0.9em;
	}

	.live {
		color: var(--live);
		font-weight: 600;
	}

	.hint {
		font-size: 0.85em;
	}
</style>
