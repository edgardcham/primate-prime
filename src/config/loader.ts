import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  CONFIG_FILE_ERRORS,
  CONFIG_FILE_GREETINGS,
  CONFIG_FILE_DISCORD_LIMIT,
  CONFIG_FILE_INSTRUCTIONS_PRIMATE,
  CONFIG_FILE_INSTRUCTIONS_LEARN,
  CONFIG_FILE_MOTD,
} from '@/constants';
import type { InMemoryConfig } from '@/types';

// ESM-compatible __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directory where config markdown files are located (relative to dist or src)
const CONFIG_DIR = join(__dirname, '..', '..', 'config');

export const getConfigFilePath = (filename: string): string =>
  join(CONFIG_DIR, filename);

/**
 * Loads a list of messages from a markdown file.
 * Expects each message to be on its own line, prefixed with '- '.
 */
export const loadMessageList = async (filename: string): Promise<string[]> => {
  const filePath = getConfigFilePath(filename);
  try {
    const content = await readFile(filePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim())
      .filter(Boolean);
  } catch (err) {
    throw new Error(
      `[config/loader] Failed to load message list from ${filename}: ${(err as Error).message}`
    );
  }
};

/**
 * Loads instructions from a markdown file.
 * Returns the content as a single string, removing the first heading if present.
 */
export const loadInstructions = async (filename: string): Promise<string> => {
  const filePath = getConfigFilePath(filename);
  try {
    const content = await readFile(filePath, 'utf8');
    // Remove the first heading (e.g., "# Instructions") if present
    return content.replace(/^#.*\n/, '').trim();
  } catch (err) {
    throw new Error(
      `[config/loader] Failed to load instructions from ${filename}: ${(err as Error).message}`
    );
  }
};

export const loadConfig = async (): Promise<InMemoryConfig> => {
  const config: InMemoryConfig = {
    errorMessages: await loadMessageList(CONFIG_FILE_ERRORS),
    greetingMessages: await loadMessageList(CONFIG_FILE_GREETINGS),
    discordLimitMessages: await loadMessageList(CONFIG_FILE_DISCORD_LIMIT),
    instructionsPrimate: await loadInstructions(
      CONFIG_FILE_INSTRUCTIONS_PRIMATE
    ),
    instructionsLearn: await loadInstructions(CONFIG_FILE_INSTRUCTIONS_LEARN),
    motd: await loadInstructions(CONFIG_FILE_MOTD),
  };
  return config;
};
