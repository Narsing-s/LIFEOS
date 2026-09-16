export async function withNetworkError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    if (/network request failed|failed to fetch|network/i.test(message)) {
      throw new Error('LIFEOS is offline or the API is unreachable. Check your connection and try again.');
    }
    throw error;
  }
}
