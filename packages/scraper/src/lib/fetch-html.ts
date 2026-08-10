import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getScraperHeaders } from '../scrapers/faithtechnology/constants.js';
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);
const STATUS_MARKER = '__SCRAPER_HTTP_STATUS__:';

export async function fetchHtml(url: string): Promise<string | null> {
  const headers = getScraperHeaders();
  const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';

  try {
    const { stdout } = await execFileAsync(
      curlCommand,
      [
        '--silent',
        '--show-error',
        '--location',
        '--connect-timeout',
        '30',
        '--max-time',
        '30',
        '--user-agent',
        headers['User-Agent'] ?? '',
        '--header',
        `Accept-Language: ${headers['Accept-Language']}`,
        '--header',
        `Accept: ${headers.Accept}`,
        '--write-out',
        `\n${STATUS_MARKER}%{http_code}`,
        url,
      ],
      {
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const markerIndex = stdout.lastIndexOf(STATUS_MARKER);
    if (markerIndex === -1) {
      logger.error('curl no devolvió código HTTP', { url });
      return null;
    }

    const body = stdout.slice(0, markerIndex);
    const status = Number(stdout.slice(markerIndex + STATUS_MARKER.length).trim());

    if (!Number.isInteger(status) || status < 200 || status >= 300) {
      logger.warn('HTTP no OK al fetchear', { url, status });
      return null;
    }

    return body;
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException & {
      stderr?: string;
      signal?: NodeJS.Signals | null;
    };

    logger.error('Fallo de red al fetchear con curl', {
      url,
      exitCode: typeof commandError.code === 'number' ? commandError.code : null,
      errorCode: typeof commandError.code === 'string' ? commandError.code : null,
      signal: commandError.signal ?? null,
      stderr: commandError.stderr?.trim() || null,
    });
    return null;
  }
}
