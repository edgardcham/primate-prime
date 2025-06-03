import OpenAI from 'openai';

import type { InMemoryConfig, Persona } from '@/types';

class OpenAIClient {
  private _config: InMemoryConfig;
  private _model: string;
  private _imageModel: string;
  private _openai: OpenAI;

  constructor(config: InMemoryConfig, model?: string, imageModel?: string) {
    this._config = config;
    this._openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    this._model = model || process.env.OPENAI_MODEL!;
    this._imageModel = imageModel || process.env.OPENAI_IMAGE_MODEL!;
  }

  private getInstructions(persona: Persona): string {
    switch (persona) {
      case 'primate':
        return this._config.instructionsPrimate;
      case 'learn':
        return this._config.instructionsLearn;
      default:
        return this._config.instructionsPrimate;
    }
  }

  async createResponse(persona: Persona, prompt: string) {
    try {
      const response = await this._openai.chat.completions.create({
        model: this._model,
        messages: [
          {
            role: 'system',
            content: this.getInstructions(persona),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Error with OpenAI:', error);
      if (error instanceof OpenAI.APIError) {
        throw new Error(error.message);
      }

      throw new Error('Error creating chat completion');
    }
  }

  public reloadConfig(newConfig: InMemoryConfig): void {
    this._config = newConfig;
  }

  async createImage(prompt: string) {
    try {
      const result = await this._openai.images.generate({
        model: this._imageModel,
        prompt: `${prompt} (in the style of a wise primate or ape-themed art)`,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      });

      if (result.data && result.data[0]) {
        return result.data[0].b64_json;
      }

      console.log('Failed to generate image', JSON.stringify(result));
      return null;
    } catch (error) {
      console.error('Error with OpenAI:', error);
      if (error instanceof OpenAI.APIError) {
        throw new Error(error.message);
      }

      throw new Error('Error creating image');
    }
  }
}

export default OpenAIClient;