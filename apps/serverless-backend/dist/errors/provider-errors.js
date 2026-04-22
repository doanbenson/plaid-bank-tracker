"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationTransientError = exports.TransferTransientError = exports.ProviderTerminalError = exports.ProviderTransientError = exports.ProviderError = void 0;
class ProviderError extends Error {
    failureType;
    code;
    constructor(message, failureType, code) {
        super(message);
        this.failureType = failureType;
        this.code = code;
        this.name = "ProviderError";
    }
}
exports.ProviderError = ProviderError;
class ProviderTransientError extends ProviderError {
    constructor(message, code) {
        super(message, "TRANSIENT", code);
        this.name = "ProviderTransientError";
    }
}
exports.ProviderTransientError = ProviderTransientError;
class ProviderTerminalError extends ProviderError {
    constructor(message, code) {
        super(message, "TERMINAL", code);
        this.name = "ProviderTerminalError";
    }
}
exports.ProviderTerminalError = ProviderTerminalError;
class TransferTransientError extends Error {
    constructor(message) {
        super(message);
        this.name = "TransferTransientError";
    }
}
exports.TransferTransientError = TransferTransientError;
class CompensationTransientError extends Error {
    constructor(message) {
        super(message);
        this.name = "CompensationTransientError";
    }
}
exports.CompensationTransientError = CompensationTransientError;
