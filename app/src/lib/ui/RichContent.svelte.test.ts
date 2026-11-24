import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RichContent from './RichContent.svelte';

describe('RichContent', () => {
	it('links URLs, www, bare domains and e-mail, leaving punctuation outside', async () => {
		await render(RichContent, {
			content:
				'Siehe https://example.org/a_(b), www.gokgs.com. Mail: go@example.de; sonst online-go.com!'
		});
		const links = Array.from(document.querySelectorAll('.RichContent a')).map((a) => [
			a.textContent,
			a.getAttribute('href'),
			a.getAttribute('target'),
			a.getAttribute('rel')
		]);
		const external = ['_blank', 'noopener noreferrer'];
		expect(links).toEqual([
			['https://example.org/a_(b)', 'https://example.org/a_(b)', ...external],
			['www.gokgs.com', 'http://www.gokgs.com', ...external],
			['go@example.de', 'mailto:go@example.de', ...external],
			['online-go.com', 'http://online-go.com', ...external]
		]);
	});

	it('shows markup as text and turns line breaks into <br>', async () => {
		await render(RichContent, { content: 'Raum\n<b>fett</b>', firstLineHeading: true });
		await expect.element(page.getByText('Raum')).toHaveClass('RichContent-heading');
		await expect.element(page.getByText(/<b>fett<\/b>/)).toBeVisible();
		expect(document.querySelector('.RichContent b')).toBeNull();
	});

	it('renders nothing for empty text', async () => {
		await render(RichContent, { content: '  ' });
		expect(document.querySelector('.RichContent')).toBeNull();
	});
});
