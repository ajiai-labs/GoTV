export type AuthLevel =
	'normal' | 'robot_ranked' | 'teacher' | 'jr_admin' | 'sr_admin' | 'super_admin';
export type UserFlags = {
	guest?: boolean;
	connected?: boolean;
	deleted?: boolean;
	sleeping?: boolean;
	avatar?: boolean;
	robot?: boolean;
	tourneyWinner?: boolean;
	tourneyRunnerUp?: boolean;
	playing?: boolean;
	playingTourney?: boolean;
	kgsPlus?: boolean;
	kgsMeijin?: boolean;
	canPlayRanked?: boolean;
	selfish?: boolean;
};
export type UserDetails = {
	channelId: number;
	forcedNoRank: boolean;
	privateEmail: boolean;
	emailWanted: boolean;
	rankWanted: boolean;
	lastOn: string;
	regStartDate: string;
	personalName: string;
	personalInfo: string;
	locale: string;
	email?: string;
	subscriptions?: string;
};
export type User = {
	name: string;
	// A-Za-z0-9, max 10 chars
	flags?: UserFlags;
	rank?: string;
	rankVal?: number;
	authLevel?: AuthLevel;
	details?: UserDetails;
};
export type UnparsedUser = {
	name: string;
	flags?: string;
	rank?: string;
	authLevel?: AuthLevel;
};
export type RoomCategory =
	| 'MAIN'
	| 'NATIONAL'
	| 'TOURNAMENT'
	| 'FRIENDLY'
	| 'SPECIAL'
	| 'LESSONS'
	| 'CLUBS'
	| 'TEMPORARY'
	| 'OTHER';
export type Room = {
	id: number;
	name: string | null | undefined;
	description: string | null | undefined;
	owners: Array<string> | null | undefined;
	users: Array<string> | null | undefined;
	category: RoomCategory | null | undefined;
	private?: boolean;
	tournOnly?: boolean;
	globalGamesOnly?: boolean;
};
export type ConversationMessage = {
	id: string;
	sender: string;
	body: string;
	date: Date | null | undefined;
	// date received; server doesn't provide it
	sending?: boolean;
	announcement?: boolean;
	moderated?: boolean;
};
export type Conversation = {
	id: number;
	user?: string;
	lastSeen?: number;
	unseenCount?: number;
	chatsDisabled?: boolean;
	messages: Array<ConversationMessage>;
	callbackKey?: number | null | undefined;
	status: 'pending' | 'created' | 'userNotFound' | 'closed';
};
export type GameType =
	| 'challenge'
	| 'demonstration'
	| 'review'
	| 'rengo_review'
	| 'teaching'
	| 'simul'
	| 'rengo'
	| 'free'
	| 'ranked'
	| 'tournament';
export type GameRuleSet = 'japanese' | 'chinese' | 'aga' | 'new_zealand';
export type GameRules = {
	size: number;
	// 2 - 38
	komi: number;
	// multiple of 0.5
	handicap?: number;
	rules?: GameRuleSet;
	timeSystem?: 'none' | 'absolute' | 'byo_yomi' | 'canadian';
	mainTime?: number;
	// seconds
	byoYomiTime?: number;
	// seconds
	byoYomiPeriods?: number;
	byoYomiStones?: number;
};
export type GameRole = 'black' | 'white' | 'black_2' | 'white_2' | 'challengeCreator' | 'owner';
export type PlayerColor = 'white' | 'black';
export type GameProposalPlayer = {
	role: GameRole;
	user?: UnparsedUser;
	name?: string;
};
export type GameProposalStatus = 'setup' | 'pending' | 'accepted' | 'declined';
export type GameProposal = {
	gameType: GameType;
	rules: GameRules;
	nigiri: boolean;
	players: Array<GameProposalPlayer>;
	private?: boolean;
	status?: GameProposalStatus;
};
export type ProposalVisibility = 'private' | 'roomOnly' | 'public';
export type ProposalEditMode = 'creating' | 'negotiating' | 'waiting';
// Scores may be a floating point number, or a string. Numbers indicate the
// score difference (positive a black win, negative a white win).
export type GameScore =
	| number
	| 'UNKNOWN'
	| 'UNFINISHED'
	| 'NO_RESULT'
	| 'B+RESIGN'
	| 'W+RESIGN'
	| 'B+FORFEIT'
	| 'W+FORFEIT'
	| 'B+TIME'
	| 'W+TIME';
export type GamePlayers = Partial<Record<GameRole, User>>;
export type GameSummary = {
	timestamp: string;
	// unique identifier
	type: GameType;
	rules: GameRules;
	players: GamePlayers;
	score?: GameScore;
	revision?: string;
	tag?: string;
	private?: boolean;
	inPlay?: boolean;
};
export type RankGraph = {
	data: {
		series: Array<{
			x: Date;
			y: number;
		}>;
	};
	months: Array<string>;
};
export type ClockState = {
	paused?: boolean;
	running?: boolean;
	time?: number;
	periodsLeft?: number;
	stonesLeft?: number;
};
export type GameAction =
	| 'MOVE'
	| 'EDIT'
	| 'SCORE'
	| 'CHALLENGE_CREATE'
	| 'CHALLENGE_SETUP'
	| 'CHALLENGE_WAIT'
	| 'CHALLENGE_ACCEPT'
	| 'CHALLENGE_SUBMITTED'
	| 'EDIT_DELAY';
export type Point = {
	x: number;
	y: number;
};
export type SgfEventType = string;
export type SgfLoc = 'PASS' | Point;
export type SgfColor = 'empty' | 'black' | 'white';
export type SgfProp = {
	name: string;
	text?: string;
	color?: SgfColor;
	loc?: SgfLoc;
	loc2?: SgfLoc;
	float?: number;
	int?: number;
};
export type SgfEvent =
	| {
			type: 'PROP_ADDED';
			nodeId: number;
			prop: SgfProp;
	  }
	| {
			type: 'PROP_REMOVED';
			nodeId: number;
			prop: SgfProp;
	  }
	| {
			type: 'PROP_CHANGED';
			nodeId: number;
			prop: SgfProp;
	  }
	| {
			type: 'CHILDREN_REORDERED';
			nodeId: number;
			children: Array<number>;
	  }
	| {
			type: 'CHILD_ADDED';
			nodeId: number;
			childNodeId: number;
			position?: number;
	  }
	| {
			type: 'PROP_GROUP_ADDED';
			nodeId: number;
			props: Array<SgfProp>;
	  }
	| {
			type: 'PROP_GROUP_REMOVED';
			nodeId: number;
			props: Array<SgfProp>;
	  }
	| {
			type: 'ACTIVATED';
			nodeId: number;
			prevNodeId: number;
	  }
	| {
			type: 'POINTER_MOVED';
			nodeId: number;
			x: number;
			y: number;
	  }
	| {
			type: 'TIMESTAMP';
			nodeId: number;
			time: number;
	  }
	| {
			type: 'SPEEX_FPP';
			nodeId: number;
			fpp: number;
	  }
	| {
			type: 'SPEEX_MUTE_CHANGED';
			nodeId: number;
			mute: boolean;
	  }
	| {
			type: 'SPEEX_DATA';
			nodeId: number;
			data: string;
	  };
export type BoardPointMark =
	| 'whiteTerritory'
	| 'blackTerritory'
	| 'triangle'
	| 'square'
	| 'circle'
	| 'cross'
	| 'dead'
	| 'active'
	| 'pendingWhite'
	| 'pendingBlack';
export type BoardMarkup = {
	marks: Record<number, Record<number, BoardPointMark>>;
	labels: Record<number, Record<number, string | null | undefined>>;
};
export type BoardState = Array<Array<PlayerColor | null | undefined>>; // y[x]

export type GameNodeComputedState = {
	blackCaptures: number;
	whiteCaptures: number;
	blackTimeLeft: number;
	whiteTimeLeft: number;
	board: BoardState;
	markup: BoardMarkup;
};
export class GameNode {
	props: Array<SgfProp>;
	children: Array<number>;
	parent: number | null | undefined;

	constructor(props: Array<SgfProp>, children: Array<number>, parent: number | null | undefined) {
		this.props = props;
		this.children = children;
		this.parent = parent;
	}
}
export type PendingMove = {
	nodeId: number;
	color: PlayerColor;
	loc: Point;
};
export type GameTree = {
	nodes: Record<number, GameNode>;
	computedState: Record<number, GameNodeComputedState>;
	messages: Record<number, Array<ConversationMessage>>;
	rootNode: number;
	activeNode: number;
	currentNode: number;
	currentLine: Array<number>;
	pendingMove?: PendingMove;
};
export type GameChannel = {
	id: number;
	type: GameType;
	time: number;
	// date received
	deletedTime?: number;
	initialProposal?: GameProposal;
	// for challenge
	sentProposal?: GameProposal;
	receivedProposals?: Array<GameProposal>;
	rules?: GameRules;
	// for non-challenge
	players: GamePlayers;
	moveNum: number;
	roomId: number;
	observers?: number;
	name?: string;
	score?: GameScore;
	actions?: Array<{
		action: GameAction;
		user: UnparsedUser;
	}>;
	clocks?: Partial<Record<GameRole, ClockState>>;
	whiteDoneSent?: boolean;
	blackDoneSent?: boolean;
	whiteScore?: boolean;
	blackScore?: boolean;
	doneId?: number;
	summary?: GameSummary;
	sgfUrl?: string;
	tree?: GameTree;
	users?: Array<string>;
	accessDenied?: string;
	undoRequest?: GameRole;
	tvSource?: 'kgs' | 'ogs';
	// OGS only: true while the real-time connection delivers this game.
	tvLive?: boolean;
	// Flags
	global?: boolean;
	over?: boolean;
	adjourned?: boolean;
	private?: boolean;
	subscribers?: boolean;
	event?: boolean;
	uploaded?: boolean;
	audio?: boolean;
	paused?: boolean;
	named?: boolean;
	saved?: boolean;
};
export type GameFilter = {
	type?: 'game' | 'challenge';
	roomId?: number | null | undefined;
	excludeBots?: boolean;
};
export type GameChatSection = {
	nodeId: number;
	moveNum: number;
	actions: Array<string>;
	messages: Array<ConversationMessage>;
};
export type ChannelType =
	'room' | 'gameList' | 'game' | 'conversation' | 'challenge' | 'archive' | 'details';
export type ChannelMembership = Record<
	string | number,
	{
		type: ChannelType;
		complete: boolean;
		stale: boolean;
	}
>;
export type AutomatchPrefs = {
	blitzOk: boolean;
	estimatedRank: string;
	fastOk: boolean;
	freeOk: boolean;
	humanOk: boolean;
	maxHandicap: number;
	mediumOk: boolean;
	rankedOk: boolean;
	robotOk: boolean;
	unrankedOk: boolean;
};
export type Playback = {
	dateStamp: string;
	gameSummary: GameSummary;
	subscribersOnly: boolean;
};
export type Index<T> = Record<string | number, T>;
export type NavOption = 'watch' | 'tv' | 'play' | 'chat' | 'search' | 'more';
export type UserDetailsRequest = {
	name: string;
	status: 'pending' | 'nonexistant' | 'received';
};
export type KgsClientState = {
	status: 'loggedOut' | 'loggingIn' | 'loggedIn' | 'loggingOut';
	network: 'online' | 'offline' | 'error';
	retryTimes: number;
};
export type Preferences = {
	username?: string;
	lastProposal?: {
		proposal: GameProposal;
		visibility: ProposalVisibility;
		notes?: string;
	};
};
// Some unfinished games we get from the archive, some from game lists
export type UnfinishedGame =
	| {
			type: 'channel';
			game: GameChannel;
	  }
	| {
			type: 'summary';
			game: GameSummary;
	  };
export type AppState = {
	readonly clientState: KgsClientState;
	readonly preferences: Preferences;
	readonly initialized: boolean;
	readonly savedAt: Date | null | undefined;
	readonly serverInfo: Record<string, any> | null | undefined;
	readonly currentUser: User | null | undefined;
	readonly loginError: string | null | undefined;
	readonly logoutError: string | null | undefined;
	readonly roomsById: Index<Room>;
	readonly gamesById: Index<GameChannel>;
	readonly gameSummariesByUser: Index<Array<GameSummary>>;
	readonly rankGraphsByChannelId: Index<RankGraph>;
	readonly activeGames: Array<GameChannel>;
	readonly challenges: Array<GameChannel>;
	readonly unfinishedGames: Array<UnfinishedGame>;
	readonly watchFilter: GameFilter;
	readonly watchGameId: (number | string) | null | undefined;
	readonly playFilter: GameFilter;
	readonly playGameId: number | null | undefined;
	readonly playChallengeId: number | null | undefined;
	readonly usersByName: Index<User>;
	readonly conversationsById: Index<Conversation>;
	readonly channelMembership: ChannelMembership;
	readonly automatchPrefs: AutomatchPrefs | null | undefined;
	// KGS automatch search running (AUTOMATCH_STATUS).
	readonly automatchEnabled: boolean;
	readonly playbacks: Array<Playback>;
	readonly nav: NavOption;
	readonly activeConversationId: number | null | undefined;
	readonly userDetailsRequest: UserDetailsRequest | null | undefined;
	readonly showUnderConstruction: boolean;
	readonly showFeedbackModal: boolean;
	readonly reviewGameId: number | null | undefined;
	readonly tvStreamUrl: string | null | undefined;
	readonly tvReplayGameId: number | null | undefined;
};
export type KgsMessage =
	// TODO - exhaustive types
	// {
	//   type: 'CHAT' | 'ANNOUNCE' | 'MODERATED_CHAT',
	//   user: User
	// } |
	// {
	//   type: 'CONVO_JOIN' | 'ROOM_JOIN',
	//   channelId: number
	// } |
	{
		type: string;
		channelId?: number;
		[key: string]: any;
	};
export type MessageDispatcher = (
	msgs: KgsMessage | Array<KgsMessage>,
	callback?: (arg0: AppState) => any
) => any;
