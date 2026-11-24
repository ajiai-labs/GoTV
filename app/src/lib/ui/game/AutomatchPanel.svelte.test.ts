import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import { getInitialState } from '#lib/model/index.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import type { AppState } from '#lib/model/types.ts';
import AutomatchPanel from './AutomatchPanel.svelte';

let actions: Record<string, ReturnType<typeof vi.fn>>;

function setState(patch: Partial<AppState>) {
	app.state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		...patch
	};
}

describe('AutomatchPanel', () => {
	beforeEach(() => {
		actions = {
			onStartAutomatch: vi.fn(),
			onCancelAutomatch: vi.fn(),
			onSetAutomatchPrefs: vi.fn()
		};
		app._actions = actions as unknown as AppActions;
		setState({});
	});

	it('starts and stops the search', async () => {
		const screen = await render(AutomatchPanel);
		await page.getByRole('checkbox', { name: 'Gegner automatisch suchen' }).click();
		expect(actions.onStartAutomatch).toHaveBeenCalled();

		setState({ automatchEnabled: true });
		await screen.rerender({});
		await page.getByRole('checkbox', { name: /Suche läuft/ }).click();
		expect(actions.onCancelAutomatch).toHaveBeenCalled();
	});

	it('saves the settings like CGoban, with at least one choice per group', async () => {
		await render(AutomatchPanel);
		await page.getByRole('button', { name: 'Autowahleinstellungen' }).click();
		await page.getByRole('button', { name: 'Rangunterschied erhöhen' }).click();
		await page.getByRole('checkbox', { name: 'Blitz' }).click();

		await page.getByRole('checkbox', { name: 'Gewertet' }).click(); // none left in Spielart
		await expect.element(page.getByRole('button', { name: 'OK' })).toBeDisabled();
		await page.getByRole('checkbox', { name: 'Frei' }).click();

		await page.getByRole('button', { name: 'OK' }).click();
		expect(actions.onSetAutomatchPrefs).toHaveBeenCalledWith(
			expect.objectContaining({
				maxHandicap: 3,
				blitzOk: true,
				fastOk: true,
				rankedOk: false,
				freeOk: true,
				humanOk: true
			})
		);
	});
});
