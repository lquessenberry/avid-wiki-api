/** Error thrown when an AVID request fails or the API returns an error code. */
export class AvidError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(
    message: string,
    options: { code?: string; status?: number | null; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AvidError";
    this.code = options.code ?? "error";
    this.status = options.status ?? null;
  }
}
