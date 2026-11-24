// getUserStatusText of the old app ("Idle", "Playing", ...), in German.
import type { User } from '#lib/model/types.ts';
import { getUserStatusText } from '#lib/model/user.ts';

const STATUS_TEXTS: Record<string, string> = {
	Idle: 'Abwesend',
	Playing: 'Spielt',
	Online: 'Online',
	Offline: 'Offline'
};

export function userStatusText(user: User): string {
	const status = getUserStatusText(user);
	return STATUS_TEXTS[status] ?? status;
}
