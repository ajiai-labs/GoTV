import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Conversation } from '#lib/model/types.ts';
import ChatMessageBar from './ChatMessageBar.svelte';

function conversation(extra: Partial<Conversation> = {}): Conversation {
	return { id: 1, messages: [], status: 'created', ...extra };
}

describe('ChatMessageBar', () => {
	it('sends the trimmed text with Enter and clears the line', async () => {
		const onSubmit = vi.fn();
		await render(ChatMessageBar, { conversation: conversation(), onSubmit });
		const input = page.getByRole('textbox', { name: 'Chatnachricht' });
		await input.fill('  Guten Abend  ');
		await userEvent.keyboard('{Enter}');
		expect(onSubmit).toHaveBeenCalledWith('Guten Abend');
		await expect.element(input).toHaveValue('');
	});

	it('sends nothing when empty or when the chat is switched off', async () => {
		const onSubmit = vi.fn();
		await render(ChatMessageBar, {
			conversation: conversation({ chatsDisabled: true }),
			onSubmit
		});
		const input = page.getByRole('textbox', { name: 'Chatnachricht' });
		await expect.element(input).toHaveAttribute('placeholder', 'Chat ist abgeschaltet');
		await input.fill('Hallo');
		await userEvent.keyboard('{Enter}');
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
