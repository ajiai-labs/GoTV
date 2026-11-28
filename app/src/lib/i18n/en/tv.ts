import type { tv as de } from '../de/tv.ts';
import type { Translation } from '../types.ts';

export const tv: Translation<typeof de> = {
	// Shared
	'tv.cancel': 'Cancel',
	'tv.onAirPlanned': 'on air now (scheduled)',

	// BroadcastCard: status line of the boards (list metadata)
	'tv.status.oneRunning': 'Game in progress',
	'tv.status.onePaused': 'Game paused',
	'tv.status.oneAdjourned': 'Game adjourned',
	'tv.status.oneOver': 'Game over',
	'tv.status.running': { one: '{count} game in progress', other: '{count} games in progress' },
	'tv.status.paused': { one: '{count} game paused', other: '{count} games paused' },
	'tv.status.adjourned': { one: '{count} game adjourned', other: '{count} games adjourned' },
	'tv.status.over': { one: '{count} game over', other: '{count} games over' },
	'tv.status.move': 'Move {move}',

	// BroadcastCard: title above the boards
	'tv.broadcast.recordingTitle': 'Final game to replay · recording',
	'tv.broadcast.boardsKgsOgs': 'Boards of the broadcast (KGS + OGS)',
	'tv.broadcast.boardsOn': { one: 'Board on {source}', other: '{count} boards on {source}' },
	'tv.broadcast.ogsOnStreamOpen': 'OGS board available when you open the stream',
	'tv.broadcast.ogsAvailable': 'OGS board available',
	'tv.broadcast.ogsLoading': 'Loading OGS board …',
	'tv.broadcast.ogsAppears': 'The OGS board appears as soon as the game starts',
	'tv.broadcast.noKgsStreamOnly': 'No KGS board – stream only',
	'tv.broadcast.noKgsBoard': 'No matching KGS board online right now',
	'tv.broadcast.boardOnly': 'Board only',
	'tv.broadcast.showVideo': 'Show video',
	'tv.broadcast.close': 'Close broadcast',
	'tv.broadcast.openBoard': 'Open board',
	'tv.broadcast.openBoards': 'Open boards',
	'tv.broadcast.ogsFailed': 'Could not load the OGS board: {error}',
	'tv.broadcast.recordingHint': 'The board appears next to the video after “Load stream”.',

	// BroadcastCard: how fresh the OGS board is
	'tv.ogsStatus.staleSince': 'Connection to OGS lost – last update at {time} ({error})',
	'tv.ogsStatus.stale': 'Connection to OGS lost ({error})',
	'tv.ogsStatus.over': 'Game over – another game between the same players appears automatically',
	'tv.ogsStatus.liveDelayed': 'Live – board delayed by {seconds} s',
	'tv.ogsStatus.live': 'Live – moves appear at once',
	'tv.ogsStatus.polling': 'Board is checked every few seconds',

	// BroadcastCard: board delay
	'tv.delay.label': 'Board delay',
	'tv.delay.off': 'off',
	'tv.delay.earlier': 'Board {seconds} seconds earlier',
	'tv.delay.later': 'Board {seconds} seconds later',

	// BroadcastCard: assigning an OGS game link
	'tv.link.assign': 'Assign OGS game link',
	'tv.link.remove': 'Remove link',
	'tv.link.inputLabel': 'OGS game link',
	'tv.link.submit': 'Assign',
	'tv.link.invalid': 'That is not an OGS game link. Expected: https://online-go.com/game/…',

	// BroadcastCard: divider and Kinomodus
	'tv.split.resize': 'Resize video and board',
	'tv.split.valueText': 'Video {percent} percent',
	'tv.split.label': 'Split between stream and board',
	'tv.split.stream': 'Stream',
	'tv.split.board': 'Board',
	'tv.cinema.enter': 'Cinema mode',
	'tv.cinema.exit': 'Exit cinema mode (Esc)',
	'tv.cinema.showChat': 'Show chat',
	'tv.cinema.hideChat': 'Hide chat',

	// CinemaExample
	'tv.example.title': 'Try GoTV',
	'tv.example.subtitle': 'Example · recording, not a live game',
	'tv.example.eventName': 'European Championship final 2026 · Andrii Kravets vs Ali Jabarin',
	'tv.example.eventNotes':
		'The EGF channel shows its current programme or its offline picture. The replay board shows the historic final and runs independently of the video.',
	'tv.example.sourceBefore': 'Game from the',
	'tv.example.sourceLink': 'official EGF archive',

	// StreamEmbed
	'tv.stream.noVideo': 'No video stream is listed for this tournament.',
	'tv.stream.cannotEmbedOn': 'This stream cannot be embedded directly ({platform}).',
	'tv.stream.cannotEmbed': 'This stream cannot be embedded directly.',
	'tv.stream.openTournamentPage': 'Open tournament page',
	'tv.stream.openExternally': 'Open externally',
	'tv.stream.placeholder':
		'The stream is embedded with the official {platform} player. GoTV connects to {platform} only after you click.',
	'tv.stream.channelHint': 'If the channel is not live right now, the player says it is offline.',
	'tv.stream.load': 'Load stream',

	// StreamChat
	'tv.streamChat.show': 'Show {platform} chat',
	'tv.streamChat.hide': 'Hide {platform} chat',
	'tv.streamChat.hint': 'loads the {platform} chat; writing needs a {platform} login',
	'tv.streamChat.frameTitle': 'Chat: {title}',

	// TvSourceBadge
	'tv.source.ogs': 'Board from online-go.com (OGS)',
	'tv.source.kgs': 'Board from the KGS Go Server',

	// TvGamePanel
	'tv.panel.over': 'Game over',
	'tv.panel.overWithScore': 'Game over: {score}',
	'tv.panel.loading': 'Loading board from {source} …',
	'tv.panel.delayWaiting':
		'Board starts in {seconds} s, so it does not run ahead of the delayed video.',
	'tv.panel.tabs': 'Game',
	'tv.panel.chat': 'Chat',
	'tv.panel.info': 'Info',
	'tv.panel.observerCount': { one: '{count} observer', other: '{count} observers' },
	'tv.panel.gameInfo': 'Game info',
	'tv.panel.observers': 'Observers',
	'tv.panel.gameChat': '{source} game chat',
	'tv.panel.noMessages': 'No chat messages yet.',
	'tv.panel.chatLoading': 'Loading chat …',

	// BoardPreviewGrid
	'tv.preview.boardAfterClick': 'Board after click',
	'tv.preview.over': 'finished',
	'tv.preview.move': 'Move {move}',
	'tv.preview.running': 'in progress',

	// OfflineNotice
	'tv.offline':
		'Offline · Replay and KataGo keep working, including tournament games opened before. Streams, live boards and new calendar data need the internet.',

	// FavoriteStar
	'tv.favorite.remove': 'Remove {name} from My GoTV',
	'tv.favorite.add': 'Add {name} to My GoTV',

	// MyGoTv
	'tv.my.title': 'My GoTV',
	'tv.my.blocked': 'Reminders are blocked in the browser',
	'tv.my.remind': 'Remind me 10 min before (while GoTV is open)',
	'tv.my.hint':
		'Mark channels and tournaments with ☆ – they then appear here with their next date.',
	'tv.my.toChannels': 'Go to channels',
	'tv.my.kindChannel': 'Channel',
	'tv.my.kindEvent': 'Tournament',
	'tv.my.now': 'on air now',
	'tv.my.nextPlanned': 'next show {when} (scheduled)',
	'tv.my.noTime': 'no fixed air time',
	'tv.my.today': 'today {time}',
	'tv.my.dayTime': '{day} {time}',

	// reminders.ts (browser notification)
	'tv.reminder.planned': 'Fixed air time {time} (scheduled)',
	'tv.reminder.starts': 'Starts at {time}',

	// ChannelsView
	'tv.channels.favorites': '★ Favourites',
	'tv.channels.players': 'Players',
	'tv.channels.organizations': 'Federations and tournaments',
	'tv.channels.loading': 'Loading channels …',
	'tv.channels.error': 'Could not load the channels (events.json not reachable).',
	'tv.channels.retry': 'Try again',
	'tv.channels.empty': 'No channels listed.',

	// ChannelCard
	'tv.channel.schedule': 'Fixed air time: {schedule} (German time)',
	'tv.channel.openOn': 'Open on {platform} (with chat)',
	'tv.channel.youtubeHint': 'Chat, like and subscribe directly on YouTube.',

	// ChannelWeek
	'tv.week.title': 'Weekly schedule · fixed air times (German time, scheduled)',
	'tv.week.today': '{day} (today)',
	'tv.week.running': '(on air now)',
	'tv.weekday.1': 'Monday',
	'tv.weekday.2': 'Tuesday',
	'tv.weekday.3': 'Wednesday',
	'tv.weekday.4': 'Thursday',
	'tv.weekday.5': 'Friday',
	'tv.weekday.6': 'Saturday',
	'tv.weekday.7': 'Sunday',

	// model/tvChannels.ts: week plan and fixed air times ("Sundays 10:30")
	'tv.weekdayShort.1': 'Mon',
	'tv.weekdayShort.2': 'Tue',
	'tv.weekdayShort.3': 'Wed',
	'tv.weekdayShort.4': 'Thu',
	'tv.weekdayShort.5': 'Fri',
	'tv.weekdayShort.6': 'Sat',
	'tv.weekdayShort.7': 'Sun',
	'tv.weekdays.1': 'Mondays',
	'tv.weekdays.2': 'Tuesdays',
	'tv.weekdays.3': 'Wednesdays',
	'tv.weekdays.4': 'Thursdays',
	'tv.weekdays.5': 'Fridays',
	'tv.weekdays.6': 'Saturdays',
	'tv.weekdays.7': 'Sundays',
	'tv.schedule.slot': '{weekdays} {time}',

	// model/OgsTvSource.ts: errors shown at the OGS board
	'tv.ogs.playerNotFound': 'OGS player not found: {name}',
	'tv.ogs.unreachable': 'OGS not reachable',
	'tv.ogs.boardUnreachable': 'OGS board not reachable',
	'tv.kgsNow.title': 'Now on KGS',
	'tv.kgsNow.hint':
		'Running KGS tournament games and games broadcast by KGS – also without a stream or calendar entry.',
	'tv.kgsNow.tournament': 'Tournament',
	'tv.kgsNow.broadcast': 'Broadcast',
	'tv.kgsNow.unknownRoom': 'unknown room',
	'tv.kgsNow.boards': { one: '{count} board', other: '{count} boards' },
	'tv.kgsNow.toBoards': 'To the board overview',
	'tv.kgsNow.boardsAdded': {
		one: '{count} board in the board overview.',
		other: '{count} boards in the board overview.'
	},
	'tv.kgsNow.boardsFull': {
		one: 'The board overview is full – {count} board still fitted.',
		other: 'The board overview is full – {count} boards still fitted.'
	}
};
