// Keeps a chat scrolled to its newest message, as the old chat did: when
// another conversation is shown or a message arrives, the list jumps to the
// bottom (also when the user had scrolled up - the old chat did the same).
import type { Attachment } from 'svelte/attachments';

export function keepNewestInView(
	watch: () => [conversationId: unknown, messageCount: number]
): Attachment<HTMLElement> {
	return (element) => {
		let lastId: unknown = undefined;
		let lastCount = 0;
		$effect(() => {
			const [id, count] = watch();
			if (count && (id !== lastId || count > lastCount)) {
				element.scrollTop = element.scrollHeight;
			}
			lastId = id;
			lastCount = count;
		});
	};
}
