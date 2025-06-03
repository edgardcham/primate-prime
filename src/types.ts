export type Env = {
  DISCORD_STARTUP_CHANNEL_ID: string;
  DISCORD_LEARN_CHANNEL_ID: string;
  DISCORD_GUILD_ID: string;
  DISCORD_APP_ID: string;
  DISCORD_TOKEN: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_IMAGE_MODEL: string;
  PRIMATE_PRIME_MOTD_CRON: string;
};

export type InMemoryConfig = {
  errorMessages: string[];
  greetingMessages: string[];
  discordLimitMessages: string[];
  instructionsPrimate: string;
  instructionsLearn: string;
  motd: string;
};

export type Persona = 'primate' | 'learn';
export type ResponseType = 'error' | 'greeting' | 'discordLimit';