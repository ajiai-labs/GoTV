import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { ogsTvSource } from '#lib/model/OgsTvSource.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { TvEvent } from '#lib/model/tv.ts';
import type { GameChannel, GameTree } from '#lib/model/types.ts';
import BroadcastCard from './BroadcastCard.svelte';

type Listener = (game: GameChannel | null, error: string | null) => void;

const LOGGED_OUT = { status: 'loggedOut', network: 'online', retryTimes: 0 } as const;
const LOGGED_IN = { status: 'loggedIn', network: 'online', retryTimes: 0 } as const;

const EVENT: TvEvent = {
	id: 'cup',
	name: 'Cup',
	date_start: '2026-06-15',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/somechannel'
};

function liveTree(sgf: string, moves: number): GameTree {
	const tree = parseSgf(sgf);
	return { ...tree, activeNode: tree.currentLine[moves], currentNode: tree.currentLine[moves] };
}

function kgsGame(extra: Partial<GameChannel> = {}): GameChannel {
	return {
		id: 42,
		type: 'tournament',
		event: true,
		moveNum: 42,
		players: { black: { name: 'anna', rank: '2d' }, white: { name: 'bert', rank: '1d' } },
		...extra
	} as GameChannel;
}

function ogsGame(extra: Partial<GameChannel> = {}): GameChannel {
	return kgsGame({ id: 7, tvSource: 'ogs', tree: liveTree('(;SZ[9];B[aa])', 1), ...extra });
}

// Captures the OGS listener so the test can deliver board updates.
function mockOgs() {
	const release = vi.fn();
	const deliveries: { listener: Listener | null } = { listener: null };
	const observe = vi.spyOn(ogsTvSource, 'observeEvent').mockImplementation((_event, listener) => {
		deliveries.listener = listener;
		return release;
	});
	return {
		observe,
		release,
		deliver: (game: GameChannel | null, error: string | null = null) =>
			deliveries.listener?.(game, error)
	};
}

function loginWith(actions: Record<string, unknown>) {
	app.state = {
		...getInitialState(LOGGED_IN),
		currentUser: { name: 'viewer', rank: '3k' },
		usersByName: {}
	};
	app._actions = actions as unknown as AppActions;
}

const card = () => document.querySelector('.BroadcastCard') as HTMLElement;
// The browser writes "minmax(0px, 1fr)".
const columns = () => card().style.gridTemplateColumns.replace('0px', '0');
const loadStream = () => page.getByRole('button', { name: 'Stream laden' }).click();

describe('BroadcastCard', () => {
	beforeEach(() => {
		window.localStorage.clear();
		app.state = getInitialState(LOGGED_OUT);
		app._actions = null;
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		window.localStorage.clear();
		app._actions = null;
		if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
		await page.viewport(414, 896);
	});

	it('keeps the stream-only fallback and joins a KGS board only on click', async () => {
		const onJoinGame = vi.fn();
		await render(BroadcastCard, { broadcast: { event: EVENT, games: [] }, onJoinGame });
		await expect.element(page.getByText('Kein KGS-Brett – nur Stream')).toBeVisible();
		expect(document.querySelector('.BroadcastCard-boards-status')).toBeNull();
	});

	it('shows the list status of a KGS board and joins it when not logged in', async () => {
		const onJoinGame = vi.fn();
		await render(BroadcastCard, { broadcast: { event: EVENT, games: [kgsGame()] }, onJoinGame });
		await expect.element(page.getByText('Partie läuft · Zug 42')).toBeVisible();
		await expect.element(page.getByText('Brett auf KGS')).toBeVisible();
		expect(document.querySelector('iframe')).toBeNull();
		(
			document.querySelector('.BroadcastCard-list button, .BroadcastCard-list a') as HTMLElement
		).click();
		expect(onJoinGame).toHaveBeenCalledWith(42);
	});

	it('summarizes parallel boards and switches the observed board in the preview grid', async () => {
		const releases = [vi.fn(), vi.fn()];
		const actions = {
			onObserveTvGame: vi.fn((id: number) => releases[id === 42 ? 0 : 1]),
			onUserDetail: vi.fn(),
			onSendGameChat: vi.fn()
		};
		loginWith(actions);
		const games = [
			kgsGame({ tree: liveTree('(;SZ[9];B[aa];W[bb])', 2) }),
			kgsGame({ id: 43, paused: true, tree: liveTree('(;SZ[9];B[cc])', 1) })
		];
		const screen = await render(BroadcastCard, { broadcast: { event: EVENT, games } });
		await expect.element(page.getByText('1 Partie läuft · 1 Partie pausiert')).toBeVisible();
		await loadStream();
		await expect.element(page.getByText('KGS-Partiechat')).toBeVisible();
		expect(actions.onObserveTvGame).toHaveBeenCalledWith(42);
		const previews = document.querySelectorAll('.BoardPreview');
		expect(previews).toHaveLength(2);
		(previews[1] as HTMLElement).click();
		await expect.poll(() => actions.onObserveTvGame.mock.calls).toEqual([[42], [43]]);
		expect(releases[0]).toHaveBeenCalledTimes(1);
		await screen.unmount();
		expect(releases[1]).toHaveBeenCalledTimes(1);
	});

	it('fills the window in Kinomodus without reloading the stream', async () => {
		mockOgs();
		await render(BroadcastCard, {
			broadcast: { event: { ...EVENT, ogs_game_id: 7 }, games: [] }
		});
		expect(document.querySelector('.BroadcastCard-cinema-enter')).toBeNull();
		await loadStream();
		const iframe = document.querySelector('iframe');
		expect(iframe).not.toBeNull();
		await page.getByRole('button', { name: 'Kinomodus', exact: true }).click();
		await expect.poll(() => card().className).toContain('BroadcastCard-cinema');
		expect(document.querySelector('iframe')).toBe(iframe);
		await expect.element(page.getByRole('heading', { name: 'Cup', level: 2 })).toBeVisible();
		expect(columns()).toBe('60% minmax(0, 1fr)');

		await page.getByRole('button', { name: 'Chat ausblenden' }).click();
		await expect.poll(() => card().className).toContain('BroadcastCard-cinema-nochat');
		await expect.element(page.getByRole('button', { name: 'Chat einblenden' })).toBeVisible();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await expect.poll(() => card().className).not.toContain('BroadcastCard-cinema');
		expect(document.querySelector('iframe')).toBe(iframe);

		await page.getByRole('button', { name: 'Kinomodus', exact: true }).click();
		await expect.poll(() => card().className).toContain('BroadcastCard-cinema');
		await page.getByRole('button', { name: 'Kinomodus beenden (Esc)' }).click();
		await expect.poll(() => card().className).not.toContain('BroadcastCard-cinema');
	});

	it('resizes video and board with the divider by keyboard and pointer', async () => {
		// Side by side only on a wide screen (iPad landscape).
		await page.viewport(1180, 820);
		loginWith({ onObserveTvGame: vi.fn(() => () => {}) });
		await render(BroadcastCard, {
			broadcast: { event: EVENT, games: [kgsGame({ tree: liveTree('(;SZ[9];B[aa];W[bb])', 2) })] }
		});
		expect(document.querySelector('[role="slider"][aria-label^="Größe"]')).toBeNull();
		await loadStream();
		const divider = page.getByRole('slider', { name: 'Größe von Video und Brett ändern' });
		await expect.element(divider).toHaveAttribute('aria-valuenow', '60');
		await expect.element(page.getByText('Zug 2', { exact: true })).toBeVisible();

		(divider.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(divider).toHaveAttribute('aria-valuenow', '58');
		expect(columns()).toBe('58% minmax(0, 1fr)');
		expect(window.localStorage.getItem('gotv.cinemaSplit')).toBe('58');
		// The arrow key resized, it did not step back a move.
		await expect.element(page.getByText('Zug 2', { exact: true })).toBeVisible();
		await userEvent.keyboard('{End}');
		await expect.element(divider).toHaveAttribute('aria-valuenow', '80');

		vi.spyOn(card(), 'getBoundingClientRect').mockReturnValue({
			left: 100,
			width: 1000
		} as DOMRect);
		const el = divider.element();
		el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 700 }));
		el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 800 }));
		el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 800 }));
		await expect.element(divider).toHaveAttribute('aria-valuenow', '70');
		expect(columns()).toBe('70% minmax(0, 1fr)');
		expect(window.localStorage.getItem('gotv.cinemaSplit')).toBe('70');
	});

	it('moves the board 5 s earlier or later and remembers it per channel', async () => {
		mockOgs();
		await render(BroadcastCard, {
			broadcast: { event: { ...EVENT, ogs_game_id: 7 }, games: [] }
		});
		await loadStream();
		const value = () => document.querySelector('.BroadcastCard-delay-value')?.textContent?.trim();
		const earlier = page.getByRole('button', { name: 'Brett 5 Sekunden früher' });
		const later = page.getByRole('button', { name: 'Brett 5 Sekunden später' });
		expect(value()).toBe('aus');
		await expect.element(earlier).toBeDisabled();
		await later.click();
		await later.click();
		await later.click();
		await expect.poll(value).toBe('15 s');
		await earlier.click();
		await expect.poll(value).toBe('10 s');
		expect(JSON.parse(window.localStorage.getItem('gotv.boardDelays') ?? '{}')).toEqual({
			'https://www.twitch.tv/somechannel': 10
		});
	});

	it('opens the OGS board when the YouTube stream cannot be embedded (@handle)', async () => {
		const ogs = mockOgs();
		await render(BroadcastCard, {
			broadcast: {
				event: {
					...EVENT,
					platform: 'youtube',
					stream_url: 'https://www.youtube.com/@somechannel',
					ogs_game_id: 7
				},
				games: []
			}
		});
		await expect.element(page.getByRole('link', { name: 'Extern öffnen' })).toBeVisible();
		await page.getByRole('button', { name: 'Brett öffnen' }).click();
		expect(ogs.observe).toHaveBeenCalledTimes(1);
	});

	it('with a board delay, shows no moves before the delay has passed', async () => {
		const ogs = mockOgs();
		window.localStorage.setItem('gotv.boardDelay', '30');
		await render(BroadcastCard, {
			broadcast: { event: { ...EVENT, ogs_game_id: 7 }, games: [] }
		});
		await loadStream();
		ogs.deliver(ogsGame({ tvLive: true }));
		await expect.element(page.getByText(/Brett startet in 30 s/)).toBeVisible();
		expect(document.querySelector('.BroadcastCard svg.board')).toBeNull();
	});

	it('says how fresh the OGS board is', async () => {
		const ogs = mockOgs();
		await render(BroadcastCard, {
			broadcast: { event: { ...EVENT, ogs_game_id: 7 }, games: [] }
		});
		await expect
			.element(page.getByText('OGS-Brett beim Öffnen des Streams verfügbar'))
			.toBeVisible();
		expect(ogs.observe).not.toHaveBeenCalled();
		await loadStream();
		expect(ogs.observe).toHaveBeenCalledTimes(1);
		const status = () =>
			document.querySelector('.BroadcastCard-ogs-status')?.textContent?.trim() ?? null;
		expect(status()).toBeNull();

		ogs.deliver(ogsGame({ tvLive: true }));
		await expect.poll(status).toBe('Live verbunden – Züge erscheinen sofort');
		await expect.element(page.getByText('OGS-Partiechat')).toBeVisible();
		ogs.deliver(ogsGame({ tvLive: false }));
		await expect.poll(status).toBe('Brett wird alle paar Sekunden abgefragt');
		ogs.deliver(ogsGame(), 'OGS HTTP 502');
		await expect
			.poll(status)
			.toMatch(
				/^Verbindung zu OGS unterbrochen – letzter Stand von \d\d:\d\d:\d\d \(OGS HTTP 502\)$/
			);
		expect(document.querySelector('.BroadcastCard-ogs-status-stale')).not.toBeNull();
		ogs.deliver(ogsGame({ over: true }));
		await expect
			.poll(status)
			.toBe('Partie beendet – eine weitere Partie derselben Spieler erscheint automatisch');

		await page.getByRole('button', { name: 'Übertragung schließen' }).click();
		expect(ogs.release).toHaveBeenCalledTimes(1);
	});

	it('assigns an OGS game link at the card and rejects other input', async () => {
		const onAssignOgsLink = vi.fn();
		await render(BroadcastCard, {
			broadcast: { event: EVENT, games: [] },
			onAssignOgsLink
		});
		await page.getByRole('button', { name: 'OGS-Partielink zuordnen' }).click();
		const input = page.getByRole('textbox', { name: 'OGS-Partielink' });
		await input.fill('https://example.org/game/5');
		await page.getByRole('button', { name: 'Zuordnen', exact: true }).click();
		await expect
			.element(
				page.getByText('Das ist kein OGS-Partielink. Erwartet: https://online-go.com/game/…')
			)
			.toBeVisible();
		expect(onAssignOgsLink).not.toHaveBeenCalled();
		await input.fill('https://online-go.com/game/92121029');
		await page.getByRole('button', { name: 'Zuordnen', exact: true }).click();
		expect(onAssignOgsLink).toHaveBeenCalledWith('cup', 92121029);
		await expect.poll(() => document.querySelector('.BroadcastCard-link-input')).toBeNull();
	});

	it('offers to remove a manual link and switches boards when the link changes', async () => {
		const onAssignOgsLink = vi.fn();
		const ogs = mockOgs();
		const screen = await render(BroadcastCard, {
			broadcast: { event: { ...EVENT, ogs_game_id: 1 }, games: [] },
			onAssignOgsLink,
			hasManualOgsLink: true
		});
		await loadStream();
		expect(ogs.observe).toHaveBeenCalledTimes(1);
		await screen.rerender({ broadcast: { event: { ...EVENT, ogs_game_id: 2 }, games: [] } });
		await expect.poll(() => ogs.observe.mock.calls.length).toBe(2);
		expect(ogs.release).toHaveBeenCalledTimes(1);
		expect(ogs.observe.mock.calls[1][0].ogs_game_id).toBe(2);
		await page.getByRole('button', { name: 'Zuordnung entfernen' }).click();
		expect(onAssignOgsLink).toHaveBeenCalledWith('cup', null);
	});
});
