import 'dotenv/config';

import { REQUIRED_ENV } from '@/constants';
import { watchConfigs } from '@/config/watcher';
import { loadConfig } from '@/config/loader';
import initCronTasks from '@/services/cron';
import PrimatePrime from '@/services/primate-prime';

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
  // Pass config to Primate Prime and other services as needed
  const primatePrime = new PrimatePrime(config);

  // Watch for config changes and reload in-memory config
  watchConfigs(async (_) => {
    try {
      const newConfig = await loadConfig();
      primatePrime.reloadConfig(newConfig);
    } catch (error) {
      console.error('Failed to reload config:', error);
    }
  });

  await primatePrime.init(); // Await the init method

  initCronTasks(primatePrime); // Call this after init completes
}

main().catch((error) => {
  console.error('Application failed to initialize:', error);
  process.exit(1);
});
