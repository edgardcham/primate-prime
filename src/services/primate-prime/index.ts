import { Events as DiscordEvents } from 'discord.js';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';

import { DISCORD_COMMANDS, DISCORD_EMOJI } from '@/constants';
import OpenAIClient from '@/services/openai';
import { DiscordService } from '@/services/discord';
import type { DiscordMessage } from '@/services/discord';

import type { InMemoryConfig } from '@/types';

class PrimatePrime {
  protected _config: InMemoryConfig;
  protected _discord: DiscordService;
  protected _openaiClient: OpenAIClient;

  constructor(
    config: InMemoryConfig,
    discordService?: DiscordService,
    openaiClient?: OpenAIClient
  ) {
    this._config = config;
    this._openaiClient = openaiClient ?? new OpenAIClient(this._config);
    this._discord = discordService ?? new DiscordService(this._config);
  }

  /**
   * Reloads the config for Primate Prime and propagates to child services.
   */
  reloadConfig(newConfig: InMemoryConfig) {
    this._config = newConfig;
    this._discord.reloadConfig(newConfig);
    this._openaiClient.reloadConfig(newConfig);
  }

  private async processMessage(message: DiscordMessage) {
    try {
      let prompt = message.content
        .replace(this._discord.mentionRegex!, '')
        .trim();
      const isLearnChannel =
        message.channel.id === process.env.DISCORD_LEARN_CHANNEL_ID;

      // Use DiscordService helper to build prompt from message chain if replying to bot
      const chainPrompt =
        await this._discord.buildPromptFromMessageChain(message);
      if (chainPrompt) {
        prompt = chainPrompt;
      }

      const usersToMention = message.mentions.users.filter(
        (user) => user.id !== this._discord.client.user?.id
      );

      // prompt openai with the enhanced content
      const response = await this._openaiClient.createResponse(
        isLearnChannel ? 'learn' : 'primate',
        prompt
      );

      if (response) {
        const reply = this._discord.buildMessageReply(
          response,
          usersToMention.map((user) => user.id)
        );
        await message.reply(reply);
      } else {
        await message.reply(this._discord.getPrimateResponse('error'));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage = this._discord.getPrimateResponse('error');

      const reply =
        error instanceof Error
          ? `${errorMessage}\n\n\`\`\`${error.message}\`\`\``
          : errorMessage;
      await message.reply(reply);
      return;
    }
  }

  public async sendMotdToStartupChannel() {
    if (!this._config.motd) {
      console.log('No MOTD configured');
      return;
    }

    await this.sendMessageToStartupChannel(this._config.motd);
  }

  public async sendMessageToStartupChannel(
    prompt: string,
    persona: 'primate' | 'learn' = 'primate'
  ) {
    if (!this._discord.startupChannelId) {
      console.error('Startup channel ID not set');
      return null;
    }

    try {
      // Generate response from OpenAI
      const response = await this._openaiClient.createResponse(persona, prompt);

      // Send the response to the startup channel
      const channel = await this._discord.client.channels.fetch(
        this._discord.startupChannelId
      );
      if (channel && channel.isTextBased()) {
        const messageOptions = this._discord.buildMessageReply(response || '');
        await (channel as any).send(messageOptions);
        return response;
      } else {
        console.error('Startup channel is not text-based');
        return null;
      }
    } catch (err) {
      console.error('Error sending message to startup channel:', err);
      return null;
    }
  }

  private async handleLearnCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const prompt = interaction.options.getString('prompt', true);
    await interaction.deferReply();

    try {
      const response = await this._openaiClient.createResponse('learn', prompt);
      const messageOptions = this._discord.buildMessageReply(response || '');
      // Convert MessageReplyOptions to InteractionEditReplyOptions
      await interaction.editReply({
        content: messageOptions.content,
        files: messageOptions.files,
      });
    } catch (error) {
      console.error('Error handling learn command:', error);

      await interaction.editReply({
        content: this._discord.getPrimateResponse('error'),
      });
      return;
    }
  }

  private async handleImageCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const prompt = interaction.options.getString('prompt', true);
    await interaction.deferReply();

    try {
      const base64Image = await this._openaiClient.createImage(prompt);

      if (base64Image) {
        const message = this._discord.buildImageReply(prompt, base64Image);

        await interaction.editReply({
          embeds: message.embeds,
          files: message.files,
        });
      } else {
        await interaction.editReply({
          content: this._discord.getPrimateResponse('error'),
        });
      }
    } catch (error) {
      console.error('Error handling image command:', error);

      const errorMessage = this._discord.getPrimateResponse('error');
      if (error instanceof Error) {
        await interaction.editReply({
          content: `${errorMessage}\n\n\`\`\`${error.message}\`\`\``,
        });
        return;
      } else {
        await interaction.editReply({
          content: errorMessage,
        });
        return;
      }
    }
  }

  public init(): Promise<void> {
    return new Promise(async (resolve) => {
      this._discord.once(DiscordEvents.ClientReady, async () => {
        console.log(`🍌 APE ONLINE! Logged in as ${this._discord.client.user?.tag}`);

        this._discord.setupMentionRegex();

        await this._discord.sendReadyMessage();
        resolve(); // Resolve the promise when ClientReady is fired
      });

      await this._discord.registerSlashCommands();

      this._discord.on(DiscordEvents.MessageCreate, async (message) => {
        // Ignore messages from other bots or from different guilds
        if (
          message.author.bot ||
          message.guild?.id !== process.env.DISCORD_GUILD_ID
        ) {
          return;
        }

        // Check if the message is a reply to the bot
        let isReplyToBot = false;
        if (message.reference && message.reference.messageId) {
          const repliedToMessage = await this._discord.getOriginalMessage(
            message as DiscordMessage
          );
          if (
            repliedToMessage &&
            repliedToMessage.author.id === this._discord.client.user?.id
          ) {
            isReplyToBot = true;
          }
        }

        // Check if the bot is mentioned directly
        const isMentioned =
          this._discord.mentionRegex &&
          this._discord.mentionRegex.test(message.content);

        // If not a reply to the bot and not mentioned, ignore the message
        if (!isReplyToBot && !isMentioned) {
          return;
        }

        // If mentionRegex is null (bot not fully initialized), and it's not a reply to the bot, ignore.
        if (!this._discord.mentionRegex && !isReplyToBot) {
          console.warn(
            'Mention regex not initialized, ignoring non-reply message.'
          );
          return;
        }

        this.processMessage(message as DiscordMessage);
      });

      this._discord.on(DiscordEvents.MessageReactionAdd, async (reaction) => {
        // Ignore reactions from:
        // 1. Other bots
        // 2. Messages not from the specified guild (server)
        if (reaction.message.guild?.id !== process.env.DISCORD_GUILD_ID) {
          return;
        }

        const isPrimateMessage =
          reaction.message?.author?.id === this._discord.client.user?.id;

        if (reaction.emoji.name === DISCORD_EMOJI) {
          const message = reaction.message as DiscordMessage;
          if (isPrimateMessage) {
            const originalPrompt =
              await this._discord.getOriginalMessage(message);
            if (originalPrompt) {
              await reaction.message.delete();
              await this.processMessage(originalPrompt as DiscordMessage);
            } else {
              console.error(
                'Original message not found or not a reply to a message'
              );
            }
          } else {
            // if the message is not from Primate Prime, we need to reformat it to be a prompt
            const messageAsPrompt = `APE EXPLAIN THIS: ${message.content}`;
            message.content = messageAsPrompt;
            await this.processMessage(message);
          }
        }
      });

      this._discord.on(
        DiscordEvents.InteractionCreate,
        async (interaction: Interaction) => {
          if (!interaction.isChatInputCommand()) return;

          switch (interaction.commandName) {
            case DISCORD_COMMANDS.LEARN:
              await this.handleLearnCommand(interaction);
              break;
            case DISCORD_COMMANDS.IMAGE:
              await this.handleImageCommand(interaction);
              break;
            default:
              console.error(
                `Invalid command received: ${interaction.commandName}`
              );
              await interaction.reply({
                content: `🍌 APE CONFUSED! INVALID COMMAND: \`${interaction.commandName}\`. USE REAL COMMAND.`,
                ephemeral: true,
              });
              return;
          }
        }
      );

      // finally log in after all event handlers have been set up
      await this._discord.login();
    });
  }
}

export default PrimatePrime;