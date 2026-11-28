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
		current: null,
		target: null,
		phase: null,
		restarting: false,
		changes: [],
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

	const v1 = {
		describe: 'desktop-v0.4.1-40-g404ad61',
		commit: '404ad61',
		date: '2026-11-28T11:45:00Z'
	};
	const v2 = {
		describe: 'desktop-v0.4.1-45-gd0aa26e',
		commit: 'd0aa26e',
		date: '2026-11-28T13:10:00Z'
	};

	it('names your version, the new one and what is new', async () => {
		const fetchFn = service({
			status: [state({ current: v1 })],
			check: state({
				behind: 5,
				current: v1,
				target: v2,
				changes: ['feat(app): update notice', 'docs: README', 'fix(app): board overview']
			})
		});
		await render(ScriptUpdate, { fetchFn: fetchFn as typeof fetch, installed: v1, playing: false });
		await expect.element(page.getByText(/Deine Version: 0\.4\.1\+40 · Stand/)).toBeVisible();
		await expect
			.element(page.getByText(/40 Änderungen nach der veröffentlichten Version 0\.4\.1/))
			.toBeVisible();
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect
			.element(page.getByText(/Neue Version: 0\.4\.1\+45 · Stand .* \(d0aa26e\)/))
			.toBeVisible();
		await page.getByText('Was ist neu').click();
		await expect.element(page.getByText(/Update notice/)).toBeVisible();
		await expect.element(page.getByText(/Board overview/)).toBeVisible();
		await expect.element(page.getByText(/README/)).not.toBeInTheDocument();
	});

	it('shows the steps as a bar while updating', async () => {
		const fetchFn = service({
			status: [
				state({ state: 'running', behind: 5, target: v2, phase: 'pull' }),
				state({ state: 'running', behind: 5, target: v2, phase: 'build' }),
				state({ state: 'running', behind: 5, target: v2, phase: 'install' }),
				state({ state: 'done', behind: 0 })
			]
		});
		await render(ScriptUpdate, { fetchFn: fetchFn as typeof fetch, pollMs: 1000, playing: false });
		await expect.element(page.getByText(/Wird installiert: 0\.4\.1\+45/)).toBeVisible();
		await expect.element(page.getByText(/Schritt 2 von 3: Bauen/)).toBeVisible();
		await expect.element(page.getByText(/Schritt 3 von 3: Installieren/)).toBeVisible();
		await expect.element(page.getByText('Aktualisiert.', { exact: true })).toBeVisible();
	});

	it('does not update during your own game', async () => {
		const fetchFn = service({ check: state({ behind: 2, target: v2 }) });
		await render(ScriptUpdate, { fetchFn: fetchFn as typeof fetch, playing: true });
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect.element(page.getByRole('button', { name: 'Jetzt aktualisieren' })).toBeDisabled();
		await expect.element(page.getByText(/Du spielst gerade eine Partie/)).toBeVisible();
	});

	it('restarts the service only when your game is over', async () => {
		const reload = vi.fn();
		const fetchFn = service({ status: [state({ state: 'done', behind: 0, restart: true })] });
		const view = await render(ScriptUpdate, {
			fetchFn: fetchFn as typeof fetch,
			reload,
			pollMs: 50,
			playing: true
		});
		await expect.element(page.getByText(/sobald deine Partie zu Ende ist/)).toBeVisible();
		await new Promise((done) => setTimeout(done, 300));
		expect(fetchFn.mock.calls.some(([url]) => url.endsWith('/restart'))).toBe(false);
		expect(reload).not.toHaveBeenCalled();
		await view.rerender({ playing: false });
		await vi.waitFor(() => expect(reload).toHaveBeenCalled(), { timeout: 8000 });
		const restart = fetchFn.mock.calls.find(([url]) => url.endsWith('/restart'));
		expect(restart?.[1]).toMatchObject({ method: 'POST', headers: { 'X-GoTV-Update': '1' } });
	});
});
