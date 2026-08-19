/** Build an Error with a standard `cause` while the CLI still targets ES2020 types. */
export function errorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'cause', {
    configurable: true,
    value: cause,
  });
  return error;
}
