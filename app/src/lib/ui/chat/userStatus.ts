// getUserStatusText of the old app ("Idle", "Playing", ...): in German
// translated, in English the original text.
import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
import type { User } from '#lib/model/types.ts';
import { getUserStatusText } from '#lib/model/user.ts';

const STATUS_TEXTS: Record<string, MessageKey> = {
	Idle: 'chat.status.idle',
	Playing: 'chat.status.playing',
	Online: 'chat.status.online',
	Offline: 'chat.status.offline'
};

export function userStatusText(user: User): string {
	const status = getUserStatusText(user);
	const key = STATUS_TEXTS[status];
	return key ? t(key) : status;
}
