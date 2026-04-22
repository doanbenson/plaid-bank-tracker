export type ProviderFailureType = "TRANSIENT" | "TERMINAL";

export class ProviderError extends Error {
  public constructor(
    message: string,
    public readonly failureType: ProviderFailureType,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ProviderTransientError extends ProviderError {
  public constructor(message: string, code: string) {
    super(message, "TRANSIENT", code);
    this.name = "ProviderTransientError";
  }
}

export class ProviderTerminalError extends ProviderError {
  public constructor(message: string, code: string) {
    super(message, "TERMINAL", code);
    this.name = "ProviderTerminalError";
  }
}

export class TransferTransientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TransferTransientError";
  }
}

export class CompensationTransientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CompensationTransientError";
  }
}
