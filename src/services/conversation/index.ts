import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import OpenAIClient from '@/services/openai';
import type { InMemoryConfig } from '@/types';

export interface ConversationMessage {
  speaker: 'alpha' | 'beta' | 'admin';
  content: string;
  timestamp: Date;
  userId?: string;
}

export interface ConversationState {
  isActive: boolean;
  channelId: string;
  currentTurn: number;
  maxTurns: number;
  lastSpeaker: 'alpha' | 'beta' | null;
  alphaId: string;
  betaId: string;
  context: ConversationMessage[];
  compactedMemory: string[];
  initialPrompt: string;
  adminId: string;
}

class ConversationService {
  private _config: InMemoryConfig;
  private _openaiClient: OpenAIClient;
  private _state: ConversationState | null = null;
  private _stateFilePath: string;

  constructor(config: InMemoryConfig, openaiClient: OpenAIClient) {
    this._config = config;
    this._openaiClient = openaiClient;
    this._stateFilePath = join(process.cwd(), 'conversation-state.json');
    this.loadState();
  }

  public reloadConfig(newConfig: InMemoryConfig): void {
    this._config = newConfig;
  }

  private loadState(): void {
    if (existsSync(this._stateFilePath)) {
      try {
        const data = readFileSync(this._stateFilePath, 'utf8');
        this._state = JSON.parse(data, (key, value) => {
          if (key === 'timestamp') return new Date(value);
          return value;
        });
      } catch (error) {
        console.error('Error loading conversation state:', error);
        this._state = null;
      }
    }
  }

  private saveState(): void {
    if (this._state) {
      try {
        writeFileSync(
          this._stateFilePath,
          JSON.stringify(this._state, null, 2)
        );
      } catch (error) {
        console.error('Error saving conversation state:', error);
      }
    }
  }

  public startConversation(
    channelId: string,
    adminId: string,
    alphaId: string,
    betaId: string,
    initialPrompt: string,
    maxTurns: number = 10
  ): boolean {
    if (this._state?.isActive) {
      return false; // Conversation already active
    }

    this._state = {
      isActive: true,
      channelId,
      currentTurn: 0,
      maxTurns,
      lastSpeaker: null,
      alphaId,
      betaId,
      context: [],
      compactedMemory: [],
      initialPrompt,
      adminId,
    };

    this.saveState();
    return true;
  }

  public continueConversation(additionalTurns: number = 5): boolean {
    if (!this._state?.isActive) {
      return false;
    }

    this._state.maxTurns += additionalTurns;
    this.saveState();
    return true;
  }

  public stopConversation(): boolean {
    if (!this._state?.isActive) {
      return false;
    }

    this._state.isActive = false;
    this.saveState();
    return true;
  }

  public getStatus(): ConversationState | null {
    return this._state;
  }

  public isConversationActive(): boolean {
    return this._state?.isActive ?? false;
  }

  public shouldRespondInChannel(channelId: string, userId: string): boolean {
    if (!this._state?.isActive || this._state.channelId !== channelId) {
      return false;
    }

    // Check if this is one of the conversation bots
    return userId === this._state.alphaId || userId === this._state.betaId;
  }

  public getNextSpeaker(): string | null {
    if (!this._state?.isActive) {
      return null;
    }

    // If no one has spoken yet, alpha starts
    if (this._state.lastSpeaker === null) {
      return this._state.alphaId;
    }

    // Alternate speakers
    return this._state.lastSpeaker === 'alpha'
      ? this._state.betaId
      : this._state.alphaId;
  }

  public addMessage(userId: string, content: string): void {
    if (!this._state?.isActive) {
      return;
    }

    const speaker =
      userId === this._state.alphaId
        ? 'alpha'
        : userId === this._state.betaId
          ? 'beta'
          : 'admin';

    const message: ConversationMessage = {
      speaker,
      content,
      timestamp: new Date(),
      userId,
    };

    this._state.context.push(message);

    if (speaker !== 'admin') {
      this._state.lastSpeaker = speaker;
      this._state.currentTurn++;
    }

    // Check if we need to compact memory
    if (this._state.context.length > 10) {
      this.compactMemory();
    }

    this.saveState();
  }

  private async compactMemory(): Promise<void> {
    if (!this._state || this._state.context.length <= 10) {
      return;
    }

    try {
      // Take the oldest 5 messages to compact
      const messagesToCompact = this._state.context.splice(0, 5);
      const conversationText = messagesToCompact
        .map((msg) => `${msg.speaker}: ${msg.content}`)
        .join('\n');

      const compactionPrompt = `Summarize this conversation into 1-2 sentences, preserving key points and context:\n\n${conversationText}`;

      const summary = await this._openaiClient.createResponse(
        'learn',
        compactionPrompt
      );

      if (summary) {
        this._state.compactedMemory.push(summary);
        console.log('[Conversation] Compacted memory:', summary);
      }
    } catch (error) {
      console.error('Error compacting memory:', error);
    }
  }

  public buildContextForBot(botId: string): string {
    if (!this._state?.isActive) {
      return '';
    }

    let context = '';

    // Add compacted memory
    if (this._state.compactedMemory.length > 0) {
      context += 'Previous conversation summary:\n';
      context += this._state.compactedMemory.join('\n') + '\n\n';
    }

    // Add recent context
    if (this._state.context.length > 0) {
      context += 'Recent conversation:\n';
      context +=
        this._state.context
          .map((msg) => `${msg.speaker}: ${msg.content}`)
          .join('\n') + '\n\n';
    }

    // Add initial prompt if this is the first message
    if (this._state.currentTurn === 0) {
      context += `Initial topic: ${this._state.initialPrompt}\n\n`;
    }

    // Determine who to tag
    const otherBotId =
      botId === this._state.alphaId ? this._state.betaId : this._state.alphaId;

    context += `You are having a conversation. Tag the other participant: <@${otherBotId}>\n`;
    context +=
      'Respond naturally and conversationally. Keep responses concise but engaging.';

    return context;
  }

  public shouldContinueConversation(): boolean {
    if (!this._state?.isActive) {
      return false;
    }

    return this._state.currentTurn < this._state.maxTurns;
  }
}

export default ConversationService;
