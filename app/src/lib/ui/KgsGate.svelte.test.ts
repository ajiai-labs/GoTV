import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { app } from '#lib/app.svelte.ts';
import { getInitialState } from '#lib/model/index.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import KgsGate from './KgsGate.svelte';

const loggedOut = { status: 'loggedOut', network: 'online', retryTimes: 0 } as const;

describe('KgsGate', () => {
	it('shows the login form once the app has started after the first render', async () => {
		app._actions = null;
		app.state = getInitialState(loggedOut);
		const children = createRawSnippet(() => ({ render: () => '<p>KGS-Seite</p>' }));
		await render(KgsGate, { children });
		await expect.element(page.getByRole('status')).toBeVisible();

		// What app.start() does: actions exist, the saved state is restored.
		app._actions = { onLogin: () => {} } as unknown as AppActions;
		app.state = { ...getInitialState(loggedOut), initialized: true };
		flushSync();

		await expect.element(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
	});
});
