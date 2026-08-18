import '../load-env.js';
import { prisma } from '@hardware-scrapping/database';
import { hashPassword } from '../services/auth.service.js';
import { logger } from '../logger.js';
import { safeErrorDetails } from '../utils/safe-error.js';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

async function main(): Promise<void> {
  const emailRaw = readArg('email');
  const password = readArg('password');

  if (!emailRaw || !password) {
    logger.error(
      'Usage: pnpm --filter @hardware-scrapping/api create-admin -- --email=admin@example.com --password=at-least-8-chars',
    );
    process.exitCode = 1;
    return;
  }

  const email = emailRaw.trim().toLowerCase();
  if (!email.includes('@')) {
    logger.error('email looks invalid');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    logger.error('password must be at least 8 characters');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.error('User already exists; refusing to overwrite', { email });
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'admin' },
  });

  logger.info('Admin user created', { id: user.id, email: user.email, role: user.role });
}

main()
  .catch((error) => {
    logger.error('create-admin failed', { error: safeErrorDetails(error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
