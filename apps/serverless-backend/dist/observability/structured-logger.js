"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStructuredLogger = void 0;
const serializeError = (error) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    return {
        message: String(error)
    };
};
const emit = (baseContext, level, message, metadata = {}) => {
    const { error, ...rest } = metadata;
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        service: baseContext.service,
        component: baseContext.component,
        message,
        ...rest
    };
    if (error !== undefined) {
        entry.error = serializeError(error);
    }
    const serialized = JSON.stringify(entry);
    if (level === "ERROR") {
        console.error(serialized);
        return;
    }
    if (level === "WARN") {
        console.warn(serialized);
        return;
    }
    console.log(serialized);
};
const createStructuredLogger = (context) => ({
    info: (message, metadata) => emit(context, "INFO", message, metadata),
    warn: (message, metadata) => emit(context, "WARN", message, metadata),
    error: (message, metadata) => emit(context, "ERROR", message, metadata)
});
exports.createStructuredLogger = createStructuredLogger;
