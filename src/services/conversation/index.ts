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

// Constants for rolling window
const WINDOW = 6;          // verbatim turns kept
const CHUNK = 6;           // size of each compaction batch
const MAX_SUMMARIES = 10;  // ring buffer for summaries

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

  public getNextSpeakerId(): string | null {
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

  public async addMessage(userId: string, content: string): Promise<void> {
    if (!this._state?.isActive) {
      return;
    }

    const speaker =
      userId === this._state.alphaId
        ? 'alpha'
        : userId === this._state.betaId
          ? 'beta'
          : 'admin';

    // Clean content by removing Discord mentions to avoid confusion
    const cleanContent = content
      .replace(/<@!?\d+>/g, '')
      .trim();

    // Duplicate guard: prevent bot->bot double posts
    const last = this._state.context.at(-1);
    if (last && last.speaker === speaker && 
        this.calculateOverlap(last.content, cleanContent) > 0.9) {
      console.log('[Conversation] Duplicate message detected, ignoring');
      return;
    }

    const message: ConversationMessage = {
      speaker,
      content: cleanContent,
      timestamp: new Date(),
      userId,
    };

    this._state.context.push(message);

    if (speaker !== 'admin') {
      this._state.lastSpeaker = speaker;
      this._state.currentTurn++;
    }

    // Use new compaction strategy
    await this.maybeCompact();

    this.saveState();
  }

  private async maybeCompact(): Promise<void> {
    if (!this._state) return;

    // How many full turns (non-admin) do we have?
    const nonAdmin = this._state.context.filter(m => m.speaker !== 'admin');
    if (nonAdmin.length <= WINDOW + CHUNK) return; // nothing to compact yet

    // Carve out the *oldest* CHUNK that sits before the last WINDOW
    const cutIndex = nonAdmin.length - WINDOW - CHUNK;
    const slice = nonAdmin.slice(cutIndex, cutIndex + CHUNK);

    // Build raw text for summary
    const convo = slice.map(m => `${m.speaker}: ${m.content}`).join('\n');

    const prompt = `summarize the following 6-turn chat in ≤25 words.
• start with a 3-word tag in brackets.
• give 1–2 short bullet lines.

${convo}`.trim();

    try {
      const summary = await this._openaiClient.createResponse('learn', prompt);
      if (!summary) return;

      // Ring-buffer the summaries
      const mem = this._state.compactedMemory;
      if (mem.length >= MAX_SUMMARIES) mem.shift();
      mem.push(summary.trim());

      // Actually remove those CHUNK messages from context
      this._state.context = this._state.context.filter(m => !slice.includes(m));

      this.saveState();
      console.log('[Conversation] Compacted:', summary);
    } catch (error) {
      console.error('Error compacting memory:', error);
    }
  }

  public buildContextForBot(botId: string): string {
    if (!this._state?.isActive) return '';

    const otherId = (botId === this._state.alphaId) 
      ? this._state.betaId 
      : this._state.alphaId;

    let out = '';

    // 1) Long-term memory (oldest → newest)
    if (this._state.compactedMemory.length) {
      out += 'conversation memory (oldest → newest):\n';
      out += this._state.compactedMemory.join('\n') + '\n\n';
    }

    // 2) Last WINDOW verbatim
    const recent = this._state.context.slice(-WINDOW);
    if (recent.length > 0) {
      out += 'recent turns:\n';
      out += recent.map(m => `${m.speaker}: ${m.content}`).join('\n') + '\n\n';
    }

    // 3) Check for overlap warning  
    if (recent.length >= 2) {
      const last = recent.at(-1);
      const prev = recent.at(-2);
      if (last && prev && last.speaker !== prev.speaker) {
        const overlap = this.calculateOverlap(last.content, prev.content);
        if (overlap > 0.8) {
          out += 'reminder: avoid repeating partner; offer fresh wording.\n\n';
        }
      }
    }

    // 4) Add initial prompt if first message
    if (this._state.currentTurn === 0) {
      out += `initial topic: ${this._state.initialPrompt}\n\n`;
    }

    // 5) Style + tag instruction
    out += `IMPORTANT: begin with <@${otherId}> and follow the STYLE rules in the system prompt.\n`;
    out += `NEVER tag yourself (<@${botId}>), ONLY tag your conversation partner.`;

    return out;
  }

  private calculateOverlap(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  public shouldContinueConversation(): boolean {
    if (!this._state?.isActive) {
      return false;
    }

    return this._state.currentTurn < this._state.maxTurns;
  }
}

export default ConversationService;
