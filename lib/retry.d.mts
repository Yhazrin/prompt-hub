export function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    retries?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (err: any) => boolean;
  }
): Promise<T>;
