<script lang="ts" module>
	// Text from KGS (chat, room descriptions, profiles) with clickable links
	// and line breaks. The old app escaped the text, ran Autolinker over it and
	// set the result as HTML. Here the text is split into plain parts and links
	// and rendered as text nodes and <a> elements - no HTML is ever built from
	// untrusted text, so nothing can be injected.

	type RichPart =
		| { type: 'text'; text: string }
		| { type: 'link'; text: string; href: string }
		| { type: 'break' };

	// Top-level domains that are linked without "http://" or "www." in front
	// (Autolinker knew all of them; these are the ones that show up in Go chat).
	const BARE_TLDS =
		'com|org|net|edu|gov|info|io|tv|app|dev|me|gg|eu|de|at|ch|nl|be|lu|fr|uk|ie|es|pt|it|' +
		'pl|cz|sk|hu|ro|bg|hr|si|rs|ua|ru|by|lt|lv|ee|fi|se|no|dk|is|gr|tr|il|jp|kr|cn|tw|hk|' +
		'sg|in|us|ca|mx|br|ar|cl|au|nz|za';

	const LINK_PATTERN = new RegExp(
		[
			// e-mail address
			'(?<email>[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,})',
			// URL with scheme
			'(?<scheme>\\bhttps?:\\/\\/[^\\s<>"]+)',
			// www.example.org/...
			'(?<www>\\bwww\\.[^\\s<>"]+)',
			// example.org/...
			'(?<bare>\\b[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.(?:' +
				BARE_TLDS +
				')\\b(?:[/?#][^\\s<>"]*)?)'
		].join('|'),
		'gi'
	);

	// Punctuation at the end belongs to the sentence, not to the link. A
	// closing bracket stays when the link opened one ("Go_(game)").
	function trimLink(text: string): string {
		let end = text.length;
		while (end > 0) {
			const ch = text[end - 1];
			if ('.,;:!?\'"'.includes(ch)) {
				end--;
				continue;
			}
			const open = { ')': '(', ']': '[', '}': '{' }[ch];
			if (open) {
				const part = text.slice(0, end);
				if (part.split(open).length <= part.split(ch).length - 1) {
					end--;
					continue;
				}
			}
			break;
		}
		return text.slice(0, end);
	}

	function linkParts(line: string): Array<RichPart> {
		const parts: Array<RichPart> = [];
		let last = 0;
		for (const match of line.matchAll(LINK_PATTERN)) {
			const groups = match.groups ?? {};
			const text = trimLink(match[0]);
			if (!text) continue;
			const href = groups.email ? 'mailto:' + text : groups.scheme ? text : 'http://' + text;
			if (match.index > last) parts.push({ type: 'text', text: line.slice(last, match.index) });
			parts.push({ type: 'link', text, href });
			last = match.index + text.length;
		}
		if (last < line.length) parts.push({ type: 'text', text: line.slice(last) });
		return parts;
	}

	// The text as lines, links and line breaks. With firstLineHeading the
	// first line becomes a heading, as before only if another line follows.
	function parseRichContent(
		content: string,
		firstLineHeading = false
	): { heading: string | null; parts: Array<RichPart> } {
		let lines = content.split(/\r\n|\r|\n/);
		let heading: string | null = null;
		if (firstLineHeading && lines.length > 1 && lines[0]) {
			heading = lines[0];
			lines = lines.slice(1);
		}
		const parts: Array<RichPart> = [];
		lines.forEach((line, index) => {
			if (index > 0) parts.push({ type: 'break' });
			parts.push(...linkParts(line));
		});
		return { heading, parts };
	}
</script>

<script lang="ts">
	let {
		content,
		firstLineHeading = false
	}: {
		content: string | null | undefined;
		firstLineHeading?: boolean | null;
	} = $props();

	let parsed = $derived(
		content && content.trim() ? parseRichContent(content, !!firstLineHeading) : null
	);
</script>

{#if parsed}
	<div class="RichContent">
		{#if parsed.heading !== null}
			<div class="RichContent-heading">{parsed.heading}</div>
		{/if}
		{#each parsed.parts as part, index (index)}
			{#if part.type === 'break'}
				<br />
			{:else if part.type === 'link'}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a link in KGS text, never a page of GoTV -->
				<a class="RichContent-link" href={part.href} target="_blank" rel="noopener noreferrer">
					{part.text}
				</a>
			{:else}
				{part.text}
			{/if}
		{/each}
	</div>
{/if}

<style>
	.RichContent {
		overflow-wrap: anywhere;
	}

	.RichContent-heading {
		font-size: 1.25rem;
		font-weight: 650;
		margin-bottom: 4px;
	}

	.RichContent-link {
		color: var(--accent);
	}

	.RichContent-link:hover {
		text-decoration: underline;
	}
</style>
