import 'dotenv/config';

import { REQUIRED_ENV } from '@/constants';
import { watchConfigs } from '@/config/watcher';
import { loadConfig } from '@/config/loader';
import initCronTasks from '@/services/cron';
import DualBotService from '@/services/dual-bot';

async function main() {
  // Validate required environment variables at startup
  const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missingEnv.length) {
    console.error(
      `Missing required environment variables: ${missingEnv.join(', ')}`
    );
    process.exit(1);
  }

  const config = await loadConfig();
  // Create dual bot service (Alpha + Beta bots)
  const dualBotService = new DualBotService(config);

  // Watch for config changes and reload in-memory config
  watchConfigs(async (_) => {
    try {
      const newConfig = await loadConfig();
      dualBotService.reloadConfig(newConfig);
    } catch (error) {
      console.error('Failed to reload config:', error);
    }
  });

  await dualBotService.init(); // Initialize both bots

  initCronTasks(dualBotService.primatePrime); // Cron tasks only for main bot
}

main().catch((error) => {
  console.error('Application failed to initialize:', error);
  process.exit(1);
});
