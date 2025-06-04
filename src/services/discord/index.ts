import {
  Client as DiscordClient,
  GatewayIntentBits,
  AttachmentBuilder,
  userMention,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type {
  Message,
  OmitPartialGroupDMChannel,
  TextChannel,
  ClientEvents,
} from 'discord.js';

import {
  DISCORD_MESSAGE_LIMIT,
  DISCORD_MAX_MESSAGE_CHAIN_LENGTH,
  DISCORD_COMMAND_DEFINITIONS,
} from '@/constants';

import type { InMemoryConfig, ResponseType } from '@/types';

export type DiscordMessage = OmitPartialGroupDMChannel<Message<boolean>>;

export class DiscordService {
  private _discordClient: DiscordClient;
  private _mentionRegex: RegExp | null = null;
  private _startupChannelId: string | undefined;
  private _config: InMemoryConfig;

  constructor(config: InMemoryConfig, discordClient?: DiscordClient) {
    this._config = config;
    this._discordClient =
      discordClient ??
      new DiscordClient({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.MessageContent,
        ],
      });
    this._startupChannelId = process.env.DISCORD_STARTUP_CHANNEL_ID;
  }

  public reloadConfig(newConfig: InMemoryConfig): void {
    this._config = newConfig;
  }

  public get client(): DiscordClient {
    return this._discordClient;
  }

  public get mentionRegex(): RegExp | null {
    return this._mentionRegex;
  }

  public set mentionRegex(regex: RegExp | null) {
    this._mentionRegex = regex;
  }

  public get startupChannelId(): string | undefined {
    return this._startupChannelId;
  }

  public getPrimateResponse(type: ResponseType): string {
    let arrayToUse: string[] = [];
    switch (type) {
      case 'error':
        arrayToUse = this._config.errorMessages;
        break;
      case 'greeting':
        arrayToUse = this._config.greetingMessages;
        break;
      case 'discordLimit':
        arrayToUse = this._config.discordLimitMessages;
        break;
      default:
        throw new Error('Invalid response type');
    }
    const index = Math.floor(Math.random() * arrayToUse.length);
    return arrayToUse[index]!;
  }

  public async sendReadyMessage(): Promise<void> {
    if (this._startupChannelId) {
      try {
        const channel = await this._discordClient.channels.fetch(
          this._startupChannelId
        );
        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).send(
            this.getPrimateResponse('greeting')
          );
        }
      } catch (err) {
        console.error('Error sending ready message:', err);
      }
    }
  }

  public buildMessageReply(content: string, allowedMentions: string[] = []) {
    if (content.length > DISCORD_MESSAGE_LIMIT) {
      const attachment = new AttachmentBuilder(Buffer.from(content, 'utf-8'), {
        name: 'primate-wisdom.md',
      });

      return {
        content: this.getPrimateResponse('discordLimit'),
        files: [attachment],
        allowedMentions: {
          users: allowedMentions,
        },
      };
    }

    return {
      content: content,
      allowedMentions: {
        users: allowedMentions,
      },
    };
  }

  public buildImageReply(prompt: string, base64Image: string) {
    return {
      files: [
        new AttachmentBuilder(Buffer.from(base64Image, 'base64'), {
          name: 'primate-art.jpeg',
        }),
      ],
      embeds: [
        new EmbedBuilder({
          title: 'Image by Leonardo Dape Vinci 🎨🍌',
          description: prompt,
          image: {
            url: 'attachment://primate-art.jpeg',
          },
        }),
      ],
    };
  }

  public async getMessageChain(
    currentMessage: DiscordMessage
  ): Promise<{ author: 'user' | 'primate'; content: string }[]> {
    const messageChain: { author: 'user' | 'primate'; content: string }[] = [];
    try {
      if (currentMessage.reference && currentMessage.reference.messageId) {
        let referencedMessage = await currentMessage.channel.messages.fetch(
          currentMessage.reference.messageId
        );
        const tempChain: { author: 'user' | 'primate'; content: string }[] = [];
        while (
          referencedMessage &&
          tempChain.length < DISCORD_MAX_MESSAGE_CHAIN_LENGTH
        ) {
          tempChain.push({
            author:
              referencedMessage.author.id === this._discordClient.user?.id
                ? 'primate'
                : 'user',
            content: referencedMessage.content,
          });
          if (
            referencedMessage.reference &&
            referencedMessage.reference.messageId
          ) {
            try {
              referencedMessage =
                await referencedMessage.channel.messages.fetch(
                  referencedMessage.reference.messageId
                );
            } catch (error) {
              console.error('Error fetching message chain:', error);
              break;
            }
          } else {
            break;
          }
        }
        messageChain.push(...tempChain.reverse());
      }
    } catch (error) {
      console.error('Error fetching message chain:', error);
    }
    messageChain.push({
      author:
        currentMessage.author.id === this._discordClient.user?.id
          ? 'primate'
          : 'user',
      content: currentMessage.content,
    });
    return messageChain;
  }

  public async getOriginalMessage(message: DiscordMessage) {
    try {
      const reference = message.reference;
      if (!reference?.messageId) {
        return null;
      }
      return await message.channel.messages.fetch(reference.messageId);
    } catch (error) {
      console.error('Error fetching original message:', error);
      return null;
    }
  }

  public async registerSlashCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(
      process.env.DISCORD_ALPHA_TOKEN!
    );

    try {
      const commands = Object.keys(DISCORD_COMMAND_DEFINITIONS)
        .map((key) => {
          const def = DISCORD_COMMAND_DEFINITIONS[key];
          if (!def) {
            return false;
          }

          const builder = new SlashCommandBuilder();
          builder.setName(key);
          builder.setDescription(def.description);

          def.parameters.forEach((param) => {
            builder.addStringOption((option) =>
              option
                .setName(param.name)
                .setDescription(param.description)
                .setRequired(param.required)
            );
          });

          return builder.toJSON();
        })
        .filter(Boolean);

      // Only register slash commands in the main server if GUILD_ID is provided
      if (process.env.DISCORD_GUILD_ID) {
        await rest.put(
          Routes.applicationGuildCommands(
            process.env.DISCORD_ALPHA_APP_ID!,
            process.env.DISCORD_GUILD_ID!
          ),
          { body: commands }
        );
        console.log('Successfully registered slash commands in main server.');
      } else {
        console.log(
          'No DISCORD_GUILD_ID provided, skipping slash command registration.'
        );
      }
    } catch (error) {
      console.error('Error registering slash command:', error);
    }
  }

  public async buildPromptFromMessageChain(
    message: DiscordMessage
  ): Promise<string | null> {
    if (message.reference && message.reference.messageId) {
      const repliedToMessage = await this.getOriginalMessage(message);
      if (
        repliedToMessage &&
        repliedToMessage.author.id === this._discordClient.user?.id
      ) {
        const messageChain = await this.getMessageChain(message);
        if (messageChain.length > 0) {
          const chainWithCleanContent = messageChain.map((entry, index) => ({
            ...entry,
            content:
              index === messageChain.length - 1 &&
              entry.author === 'user' &&
              this._discordClient.user?.id
                ? entry.content
                    .replace(
                      new RegExp(`<@${this._discordClient.user.id}>`, 'g'),
                      ''
                    )
                    .trim()
                : entry.content,
          }));

          return chainWithCleanContent
            .map(
              (entry) =>
                `${entry.author === 'user' ? 'User' : 'Primate Prime'}: ${entry.content}`
            )
            .join('\n');
        }
      }
    }
    return null;
  }

  public setupMentionRegex(): void {
    if (this._discordClient.user?.id) {
      this._mentionRegex = new RegExp(
        userMention(this._discordClient.user.id),
        'g'
      );
    }
  }

  public on<K extends keyof ClientEvents>(
    event: K,
    listener: (...args: ClientEvents[K]) => void
  ): void {
    this._discordClient.on(event, listener);
  }

  public once<K extends keyof ClientEvents>(
    event: K,
    listener: (...args: ClientEvents[K]) => void
  ): void {
    this._discordClient.once(event, listener);
  }

  public async login(): Promise<void> {
    await this._discordClient.login(process.env.DISCORD_ALPHA_TOKEN!);
  }
}
