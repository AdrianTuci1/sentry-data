"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObservationRecorder = exports.ObservationRecorder = exports.ConsoleObservationSink = exports.MemoryObservationSink = void 0;
class MemoryObservationSink {
    constructor() {
        this.traces = [];
    }
    async write(trace) {
        this.traces.push(trace);
    }
}
exports.MemoryObservationSink = MemoryObservationSink;
class ConsoleObservationSink {
    async write(trace) {
        const last = trace.checkpoints[trace.checkpoints.length - 1];
        if (!last) {
            return;
        }
        const prefix = last.status === 'ok'
            ? '[OK]'
            : last.status === 'warn'
                ? '[WARN]'
                : last.status === 'fail'
                    ? '[FAIL]'
                    : '[INFO]';
        console.log(`${prefix} ${last.message}`, {
            requestId: trace.requestId,
            stage: last.stage,
            details: last.details
        });
    }
}
exports.ConsoleObservationSink = ConsoleObservationSink;
class ObservationRecorder {
    constructor(requestId, sinks = [], route) {
        this.sinks = sinks;
        this.trace = {
            requestId,
            route,
            createdAt: new Date().toISOString(),
            checkpoints: []
        };
    }
    checkpoint(stage, status, message, details) {
        const checkpoint = {
            requestId: this.trace.requestId,
            stage,
            status,
            message,
            details,
            createdAt: new Date().toISOString()
        };
        this.trace.checkpoints.push(checkpoint);
        void this.flush();
        return checkpoint;
    }
    summarize(summary) {
        this.trace.summary = summary;
        void this.flush();
        return this.snapshot();
    }
    snapshot() {
        return {
            ...this.trace,
            checkpoints: [...this.trace.checkpoints],
            summary: this.trace.summary ? { ...this.trace.summary } : undefined
        };
    }
    async flush() {
        await Promise.all(this.sinks.map((sink) => sink.write(this.snapshot())));
    }
}
exports.ObservationRecorder = ObservationRecorder;
const createObservationRecorder = (requestId, sinks = [], route) => new ObservationRecorder(requestId, sinks, route);
exports.createObservationRecorder = createObservationRecorder;
