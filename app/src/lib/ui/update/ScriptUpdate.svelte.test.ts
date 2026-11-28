import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScriptUpdate from './ScriptUpdate.svelte';
import type { ScriptUpdateStatus } from '#lib/model/scriptUpdate.ts';

function state(partial: Partial<ScriptUpdateStatus>): ScriptUpdateStatus {
	return {
		state: 'idle',
		error: null,
		behind: null,
		dirty: false,
		restart: false,
		log: [],
		...partial
	};
}

// The local GoTV service: answers per action from a script of states.
function service(answers: {
	status?: Array<ScriptUpdateStatus>;
	check?: ScriptUpdateStatus;
	run?: ScriptUpdateStatus;
}) {
	const statuses = [...(answers.status ?? [state({})])];
	return vi.fn((url: string, init?: RequestInit) => {
		const json = (data: unknown) =>
			Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
		if (url.endsWith('/check')) return json(answers.check);
		if (url.endsWith('/run')) return json(answers.run);
		void init;
		return json(statuses.length > 1 ? statuses.shift() : statuses[0]);
	});
}

describe('ScriptUpdate', () => {
	it('finds new changes, updates and offers to reload', async () => {
		const reload = vi.fn();
		const fetchFn = service({
			status: [
				state({}),
				state({ state: 'running', behind: 2 }),
				state({ state: 'done', behind: 0 })
			],
			check: state({ behind: 2 }),
			run: state({ state: 'running', behind: 2 })
		});
		await render(ScriptUpdate, { fetchFn: fetchFn as typeof fetch, reload, pollMs: 50 });
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect.element(page.getByText('Neue Änderungen auf GitHub: 2.')).toBeVisible();
		await page.getByRole('button', { name: 'Jetzt aktualisieren' }).click();
		await expect.element(page.getByText(/GoTV wird aktualisiert/)).toBeVisible();
		// The page sends only fixed actions, the POSTs with the page header.
		const run = fetchFn.mock.calls.find(([url]) => url.endsWith('/run'));
		expect(run?.[1]).toMatchObject({ method: 'POST', headers: { 'X-GoTV-Update': '1' } });
		// Two polls of the running update, then done.
		await expect.element(page.getByRole('button', { name: 'Neu laden' })).toBeVisible();
		await expect.element(page.getByText('Aktualisiert.', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Neu laden' }).click();
		expect(reload).toHaveBeenCalled();
	});

	it('says when GoTV is current, and leaves own changes alone', async () => {
		await render(ScriptUpdate, {
			fetchFn: service({ check: state({ behind: 0 }) }) as typeof fetch
		});
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect.element(page.getByText('Du hast die neueste Version.')).toBeVisible();
	});

	it('does not offer the update with own changes in the GoTV folder', async () => {
		await render(ScriptUpdate, {
			fetchFn: service({ check: state({ behind: 3, dirty: true }) }) as typeof fetch
		});
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect.element(page.getByText(/eigene Änderungen/)).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Jetzt aktualisieren' }))
			.not.toBeInTheDocument();
	});

	it('shows what went wrong in a failed install', async () => {
		await render(ScriptUpdate, {
			fetchFn: service({
				status: [state({ state: 'failed', error: 'installFailed', log: ['npm fehlt.'] })]
			}) as typeof fetch
		});
		await expect
			.element(page.getByText('Bauen oder Installieren ist fehlgeschlagen.'))
			.toBeVisible();
		await page.getByText('Details').click();
		await expect.element(page.getByText('npm fehlt.')).toBeVisible();
	});

	it('explains the one manual update for an older GoTV service', async () => {
		const fetchFn = vi.fn(() => Promise.resolve(new Response('Not found', { status: 404 })));
		await render(ScriptUpdate, { fetchFn: fetchFn as typeof fetch });
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect.element(page.getByText(/kann sich noch nicht selbst aktualisieren/)).toBeVisible();
	});

	it('reloads by itself after the service restarted', async () => {
		const reload = vi.fn();
		await render(ScriptUpdate, {
			fetchFn: service({
				status: [state({ state: 'done', behind: 0, restart: true })]
			}) as typeof fetch,
			reload,
			pollMs: 50
		});
		await expect.element(page.getByText(/startet neu/)).toBeVisible();
		await vi.waitFor(() => expect(reload).toHaveBeenCalled(), { timeout: 8000 });
	});
});
