import { Events as DiscordEvents } from 'discord.js';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';

import { DISCORD_COMMANDS, DISCORD_EMOJI } from '@/constants';
import OpenAIClient from '@/services/openai';
import { DiscordService } from '@/services/discord';
import type { DiscordMessage } from '@/services/discord';
import type ConversationService from '@/services/conversation';

import type { InMemoryConfig } from '@/types';

class PrimatePrime {
  protected _config: InMemoryConfig;
  protected _discord: DiscordService;
  protected _openaiClient: OpenAIClient;
  protected _conversationService?: ConversationService;

  constructor(
    config: InMemoryConfig,
    discordService?: DiscordService,
    openaiClient?: OpenAIClient,
    conversationService?: ConversationService
  ) {
    this._config = config;
    this._openaiClient = openaiClient ?? new OpenAIClient(this._config);
    this._discord = discordService ?? new DiscordService(this._config);
    this._conversationService = conversationService;
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
      // Only remove the bot's own mention, preserve other user mentions
      let prompt = message.content;
      if (this._discord.mentionRegex) {
        // Replace only the bot's mention
        const botMention = `<@${this._discord.client.user?.id}>`;
        prompt = prompt.replace(new RegExp(botMention, 'g'), '').trim();
      }

      // Only use learn mode in the main server's learn channel
      const isLearnChannel =
        process.env.DISCORD_GUILD_ID &&
        message.guild?.id === process.env.DISCORD_GUILD_ID &&
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

      // Debug logging
      console.log('[Primate Prime] Processing message with prompt:', prompt);
      console.log(
        '[Primate Prime] Users to mention:',
        usersToMention.map((u) => `${u.username} (${u.id})`)
      );

      // Check if user is asking for an image in chat (for guest servers)
      const imageKeywords = [
        'draw',
        'create',
        'generate',
        'make',
        'paint',
        'sketch',
        'picture',
        'image',
        'art',
      ];
      const isImageRequest =
        imageKeywords.some((keyword) =>
          prompt.toLowerCase().includes(keyword)
        ) &&
        (prompt.toLowerCase().includes('image') ||
          prompt.toLowerCase().includes('picture') ||
          prompt.toLowerCase().includes('art'));

      if (
        isImageRequest &&
        message.guild?.id !== process.env.DISCORD_GUILD_ID
      ) {
        // Guest server image generation via chat
        const imagePrompt = prompt
          .replace(
            /^(draw|create|generate|make|paint|sketch)\s+(an?\s+)?(image|picture|art)\s+(of\s+)?/i,
            ''
          )
          .trim();
        console.log(
          '[Primate Prime] Image request detected in guest server:',
          imagePrompt
        );

        const base64Image = await this._openaiClient.createImage(
          `${imagePrompt} (in the style of a wise primate or ape-themed art)`
        );
        if (base64Image) {
          const imageReply = this._discord.buildImageReply(
            imagePrompt,
            base64Image
          );
          await message.reply(imageReply);
          return;
        }
      }

      // prompt openai with the enhanced content
      const response = await this._openaiClient.createResponse(
        isLearnChannel ? 'learn' : 'primate',
        prompt
      );

      console.log('[Primate Prime] AI Response:', response);

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
      
      // Handle missing permissions gracefully
      if (error instanceof Error && error.message.includes('Missing Permissions')) {
        try {
          await message.reply('🍌 APE NO HAVE PERMISSION! Ask admin to give ape "Attach Files" power!');
        } catch {
          // Can't even send basic message - just log it
          console.error('Cannot send any messages to this channel - missing basic permissions');
        }
        return;
      }

      const errorMessage = this._discord.getPrimateResponse('error');
      try {
        const reply =
          error instanceof Error
            ? `${errorMessage}\n\n\`\`\`${error.message}\`\`\``
            : errorMessage;
        await message.reply(reply);
      } catch {
        // Fallback to simple message if detailed error fails
        try {
          await message.reply(errorMessage);
        } catch {
          console.error('Cannot send any messages to this channel');
        }
      }
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
      // Send the response to the startup channel
      const channel = await this._discord.client.channels.fetch(
        this._discord.startupChannelId
      );

      // Only send messages if channel is in main server (when DISCORD_GUILD_ID is set)
      if (process.env.DISCORD_GUILD_ID && channel && 'guild' in channel) {
        if (channel.guild?.id !== process.env.DISCORD_GUILD_ID) {
          console.log('Skipping message - startup channel not in main server');
          return null;
        }
      }

      if (channel && channel.isTextBased()) {
        // Generate response from OpenAI
        const response = await this._openaiClient.createResponse(
          persona,
          prompt
        );
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
      const base64Image = await this._openaiClient.createImage(
        `${prompt} (in the style of a wise primate or ape-themed art)`
      );

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

  private async handleStartCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    await interaction.deferReply();

    if (!this._conversationService) {
      await interaction.editReply({
        content: '🍌 APE CONFUSED! Conversation service not available.',
      });
      return;
    }

    const prompt = interaction.options.getString('prompt', true);
    const alphaId = interaction.options.getString('alpha_id', true);
    const betaId = interaction.options.getString('beta_id', true);
    const turns = interaction.options.getString('turns') || '10';

    try {
      const maxTurns = parseInt(turns, 10) || 10;
      const success = this._conversationService.startConversation(
        interaction.channel?.id || '',
        interaction.user.id,
        alphaId,
        betaId,
        prompt,
        maxTurns
      );

      if (success) {
        await interaction.editReply({
          content: `🗣️ **Conversation Started!**\n**Topic**: ${prompt}\n**Turns**: ${maxTurns}\n**Alpha**: <@${alphaId}>\n**Beta**: <@${betaId}>\n\nLet the discussion begin! 🍌`,
        });

        // Tag alpha bot to start the conversation
        await interaction.followUp({
          content: `<@${alphaId}> ${prompt}`,
        });
      } else {
        await interaction.editReply({
          content:
            '🍌 APE SAYS NO! Conversation already active. Use `/stop` first.',
        });
      }
    } catch (error) {
      console.error('Error handling start command:', error);
      await interaction.editReply({
        content: '🍌 APE BRAIN MALFUNCTION! Failed to start conversation.',
      });
    }
  }

  private async handleContinueCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    if (!this._conversationService) {
      await interaction.reply({
        content: '🍌 APE CONFUSED! Conversation service not available.',
        ephemeral: true,
      });
      return;
    }

    const turns = interaction.options.getString('turns') || '5';
    const additionalTurns = parseInt(turns, 10) || 5;

    const success =
      this._conversationService.continueConversation(additionalTurns);

    if (success) {
      const status = this._conversationService.getStatus();
      await interaction.reply({
        content: `🔄 **Conversation Continued!**\nAdded ${additionalTurns} more turns.\n**Total turns now**: ${status?.maxTurns || 0}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '🍌 APE CONFUSED! No active conversation to continue.',
        ephemeral: true,
      });
    }
  }

  private async handleStopCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    if (!this._conversationService) {
      await interaction.reply({
        content: '🍌 APE CONFUSED! Conversation service not available.',
        ephemeral: true,
      });
      return;
    }

    const success = this._conversationService.stopConversation();

    if (success) {
      await interaction.reply({
        content:
          '⏹️ **Conversation Stopped!**\nThe bots have been silenced. 🍌',
      });
    } else {
      await interaction.reply({
        content: '🍌 APE SAYS: No conversation to stop!',
        ephemeral: true,
      });
    }
  }

  private async handleStatusCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    if (!this._conversationService) {
      await interaction.reply({
        content: '🍌 APE CONFUSED! Conversation service not available.',
        ephemeral: true,
      });
      return;
    }

    const status = this._conversationService.getStatus();

    if (!status || !status.isActive) {
      await interaction.reply({
        content:
          '📊 **No Active Conversation**\nUse `/start` to begin a new conversation.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `📊 **Conversation Status**\n**Active**: ${status.isActive ? '✅' : '❌'}\n**Turn**: ${status.currentTurn}/${status.maxTurns}\n**Alpha**: <@${status.alphaId}>\n**Beta**: <@${status.betaId}>\n**Topic**: ${status.initialPrompt}`,
      ephemeral: true,
    });
  }

  public init(): Promise<void> {
    return new Promise(async (resolve) => {
      this._discord.once(DiscordEvents.ClientReady, async () => {
        console.log(
          `🍌 APE ONLINE! Logged in as ${this._discord.client.user?.tag}`
        );

        this._discord.setupMentionRegex();

        await this._discord.sendReadyMessage();
        resolve(); // Resolve the promise when ClientReady is fired
      });

      await this._discord.registerSlashCommands();

      this._discord.on(DiscordEvents.MessageCreate, async (message) => {
        // Ignore messages from other bots
        if (message.author.bot) {
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
        // Ignore reactions from messages without a guild (DMs)
        if (!reaction.message.guild) {
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

          // Only process slash commands in the main server
          if (
            process.env.DISCORD_GUILD_ID &&
            interaction.guild?.id !== process.env.DISCORD_GUILD_ID
          ) {
            await interaction.reply({
              content: `🍌 APE SLASH COMMANDS ONLY WORK IN MAIN JUNGLE! This is guest territory.`,
              ephemeral: true,
            });
            return;
          }

          switch (interaction.commandName) {
            case DISCORD_COMMANDS.LEARN:
              await this.handleLearnCommand(interaction);
              break;
            case DISCORD_COMMANDS.IMAGE:
              await this.handleImageCommand(interaction);
              break;
            case DISCORD_COMMANDS.START:
              await this.handleStartCommand(interaction);
              break;
            case DISCORD_COMMANDS.CONTINUE:
              await this.handleContinueCommand(interaction);
              break;
            case DISCORD_COMMANDS.STOP:
              await this.handleStopCommand(interaction);
              break;
            case DISCORD_COMMANDS.STATUS:
              await this.handleStatusCommand(interaction);
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
