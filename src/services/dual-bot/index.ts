import {
  Client as DiscordClient,
  Events as DiscordEvents,
  GatewayIntentBits,
} from 'discord.js';
import { DiscordService } from '@/services/discord';
import PrimatePrime from '@/services/primate-prime';
import ConversationService from '@/services/conversation';
import OpenAIClient from '@/services/openai';
import type { DiscordMessage } from '@/services/discord';
import type { InMemoryConfig } from '@/types';

class DualBotService {
  private _config: InMemoryConfig;
  private _alphaBotClient: DiscordClient;
  private _betaBotClient: DiscordClient;
  private _discordService: DiscordService;
  private _primatePrime: PrimatePrime;
  private _conversationService: ConversationService;
  private _openaiClient: OpenAIClient;

  constructor(config: InMemoryConfig) {
    this._config = config;
    this._openaiClient = new OpenAIClient(this._config);
    this._conversationService = new ConversationService(
      this._config,
      this._openaiClient
    );

    // Alpha bot client (main Primate Prime)
    this._alphaBotClient = new DiscordClient({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Beta bot client (conversation only)
    this._betaBotClient = new DiscordClient({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Create Discord service with alpha bot client
    this._discordService = new DiscordService(
      this._config,
      this._alphaBotClient
    );

    // Create Primate Prime with alpha bot
    this._primatePrime = new PrimatePrime(
      this._config,
      this._discordService,
      this._openaiClient,
      this._conversationService
    );
  }

  public reloadConfig(newConfig: InMemoryConfig): void {
    this._config = newConfig;
    this._primatePrime.reloadConfig(newConfig);
    this._conversationService.reloadConfig(newConfig);
  }

  private async processBetaBotMessage(message: DiscordMessage): Promise<void> {
    // Beta bot ONLY responds in conversation channel in main server
    if (message.channel.id !== process.env.DISCORD_CONVERSATION_CHANNEL_ID) {
      return;
    }

    // Beta bot ONLY works in main server
    if (message.guild?.id !== process.env.DISCORD_GUILD_ID) {
      return;
    }

    // Check if beta bot is mentioned
    const betaBotMention = `<@${this._betaBotClient.user?.id}>`;
    if (!message.content.includes(betaBotMention)) {
      return;
    }

    // Check if this is part of an active conversation
    if (
      !this._conversationService.shouldRespondInChannel(
        message.channel.id,
        this._betaBotClient.user?.id || ''
      )
    ) {
      return;
    }

    try {
      // Remove beta bot's mention and clean up prompt
      let prompt = message.content
        .replace(new RegExp(betaBotMention, 'g'), '')
        .trim();

      // Add this message to conversation context
      this._conversationService.addMessage(message.author.id, message.content);

      // Build context for beta bot
      const context = this._conversationService.buildContextForBot(
        this._betaBotClient.user?.id || ''
      );
      const fullPrompt = context + '\n\nRespond to: ' + prompt;

      // Generate response using vanilla personality
      const response = await this._openaiClient.createResponse(
        'vanilla',
        fullPrompt
      );

      if (response) {
        const reply = this._discordService.buildMessageReply(response);
        await message.reply(reply);

        // Add beta bot's response to conversation context
        this._conversationService.addMessage(
          this._betaBotClient.user?.id || '',
          response
        );
      }
    } catch (error) {
      console.error('Error processing beta bot message:', error);
    }
  }

  public async init(): Promise<void> {
    // Initialize alpha bot (Primate Prime)
    await this._primatePrime.init();

    // Initialize beta bot
    this._betaBotClient.once(DiscordEvents.ClientReady, () => {
      console.log(`🤖 Beta bot online: ${this._betaBotClient.user?.tag}`);
    });

    // Beta bot message handling - ONLY conversation channel
    this._betaBotClient.on(DiscordEvents.MessageCreate, async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      await this.processBetaBotMessage(message as DiscordMessage);
    });

    // Login both bots
    await this._betaBotClient.login(process.env.DISCORD_BETA_TOKEN!);

    console.log(
      '🍌 Dual bot system initialized - Alpha (Primate Prime) + Beta (Conversation)'
    );
  }

  public get conversationService(): ConversationService {
    return this._conversationService;
  }

  public get primatePrime(): PrimatePrime {
    return this._primatePrime;
  }

  public getBetaBotId(): string {
    return this._betaBotClient.user?.id || '';
  }

  public getAlphaBotId(): string {
    return this._alphaBotClient.user?.id || '';
  }
}

export default DualBotService;
