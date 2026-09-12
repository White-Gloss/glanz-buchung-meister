export class BitrixError extends Error {
  code: string;
  status: number;
  review: boolean;
  retryable: boolean;
  constructor(
    message: string,
    code: string,
    status = 0,
    opts?: { review?: boolean; retryable?: boolean },
  ) {
    super(message);
    this.name = "BitrixError";
    this.code = code;
    this.status = status;
    this.review = opts?.review ?? false;
    this.retryable = opts?.retryable ?? (status === 429 || status >= 500);
  }
}

export type BitrixCall = <T>(method: string, path: string, body?: unknown) => Promise<T>;
