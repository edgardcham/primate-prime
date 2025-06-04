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
      const response = await this._openai.responses.create({
        model: this._model,
        tools: [
          {
            type: 'web_search_preview',
            search_context_size: 'low',
          },
        ],
        instructions: this.getInstructions(persona),
        input: prompt,
      });

      return response.output_text;
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
        prompt,
        n: 1,
        output_format: 'jpeg',
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
