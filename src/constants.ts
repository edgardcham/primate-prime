export const DISCORD_MESSAGE_LIMIT = 2000;
export const DISCORD_MAX_MESSAGE_CHAIN_LENGTH = 10;
export const DISCORD_EMOJI = 'banana';
export const DISCORD_COMMANDS = {
  LEARN: 'learn',
  IMAGE: 'image',
  START: 'start',
  CONTINUE: 'continue',
  STOP: 'stop',
  STATUS: 'status',
};

// Config file names for hot-swappable markdown configs
export const CONFIG_FILE_ERRORS = 'errors.md';
export const CONFIG_FILE_GREETINGS = 'greetings.md';
export const CONFIG_FILE_DISCORD_LIMIT = 'discord_limit.md';
export const CONFIG_FILE_INSTRUCTIONS_PRIMATE = 'instructions_primate.md';
export const CONFIG_FILE_INSTRUCTIONS_LEARN = 'instructions_learn.md';
export const CONFIG_FILE_INSTRUCTIONS_VANILLA = 'instructions_vanilla.md';
export const CONFIG_FILE_MOTD = 'motd.md';

type DiscordCommand = (typeof DISCORD_COMMANDS)[keyof typeof DISCORD_COMMANDS];

export const DISCORD_COMMAND_DEFINITIONS: Record<
  DiscordCommand,
  {
    description: string;
    parameters: { name: string; description: string; required: boolean }[];
  }
> = {
  [DISCORD_COMMANDS.LEARN]: {
    description: 'Learn with Professor Primate! 🍌',
    parameters: [
      {
        name: 'prompt',
        description: 'Your question for the wise ape',
        required: true,
      },
    ],
  },
  [DISCORD_COMMANDS.IMAGE]: {
    description: 'Generate image with Primate Prime! 🎨🍌',
    parameters: [
      {
        name: 'prompt',
        description: 'Describe what ape should create',
        required: true,
      },
    ],
  },
  [DISCORD_COMMANDS.START]: {
    description: 'Start bot conversation 🗣️',
    parameters: [
      {
        name: 'prompt',
        description: 'Initial conversation topic',
        required: true,
      },
      {
        name: 'alpha_id',
        description: 'Alpha bot user ID',
        required: true,
      },
      {
        name: 'beta_id',
        description: 'Beta bot user ID',
        required: true,
      },
      {
        name: 'turns',
        description: 'Number of conversation turns',
        required: false,
      },
    ],
  },
  [DISCORD_COMMANDS.CONTINUE]: {
    description: 'Continue bot conversation 🔄',
    parameters: [
      {
        name: 'turns',
        description: 'Additional turns to continue',
        required: false,
      },
    ],
  },
  [DISCORD_COMMANDS.STOP]: {
    description: 'Stop bot conversation ⏹️',
    parameters: [],
  },
  [DISCORD_COMMANDS.STATUS]: {
    description: 'Check conversation status 📊',
    parameters: [],
  },
};

export const REQUIRED_ENV = [
  'DISCORD_STARTUP_CHANNEL_ID',
  'DISCORD_LEARN_CHANNEL_ID',
  'DISCORD_CONVERSATION_CHANNEL_ID',
  'DISCORD_GUILD_ID',
  'DISCORD_ALPHA_TOKEN',
  'DISCORD_ALPHA_APP_ID',
  'DISCORD_BETA_TOKEN',
  'DISCORD_BETA_APP_ID',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_IMAGE_MODEL',
  'PRIMATE_PRIME_MOTD_CRON',
];
