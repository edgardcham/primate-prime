import cron from 'node-cron';
import type PrimatePrime from '@/services/primate-prime';

const DEFAULT_CRON = '0 8 * * *';

const initCronTasks = (primatePrime: PrimatePrime) => {
  // Only schedule cron jobs if we have a main server configured
  if (!process.env.DISCORD_GUILD_ID) {
    console.log(
      'No DISCORD_GUILD_ID configured, skipping cron job initialization'
    );
    return;
  }

  const cronExpr = process.env.PRIMATE_PRIME_MOTD_CRON || DEFAULT_CRON;
  console.log(`Scheduling MOTD cron job with expression: ${cronExpr}`);

  // greeting with MOTD
  cron.schedule(cronExpr, () => {
    console.log('Running scheduled MOTD task');
    primatePrime.sendMotdToStartupChannel();
  });
};

export default initCronTasks;
