import cron from 'node-cron';
import type PrimatePrime from '@/services/primate-prime';

const DEFAULT_CRON = '0 8 * * *';

const initCronTasks = (primatePrime: PrimatePrime) => {
  const cronExpr = process.env.PRIMATE_PRIME_MOTD_CRON || DEFAULT_CRON;
  // greeting with MOTD
  cron.schedule(cronExpr, () => primatePrime.sendMotdToStartupChannel());
};

export default initCronTasks;