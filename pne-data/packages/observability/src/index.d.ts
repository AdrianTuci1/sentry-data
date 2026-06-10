export type ObservationStatus = 'started' | 'ok' | 'warn' | 'fail' | 'skipped';
export interface ObservationCheckpoint {
    requestId: string;
    stage: string;
    status: ObservationStatus;
    message: string;
    details?: Record<string, unknown>;
    createdAt: string;
}
export interface ObservationTrace {
    requestId: string;
    route?: string;
    createdAt: string;
    checkpoints: ObservationCheckpoint[];
    summary?: Record<string, unknown>;
}
export interface ObservationSink {
    write(trace: ObservationTrace): Promise<void>;
}
export declare class MemoryObservationSink implements ObservationSink {
    traces: ObservationTrace[];
    write(trace: ObservationTrace): Promise<void>;
}
export declare class ConsoleObservationSink implements ObservationSink {
    write(trace: ObservationTrace): Promise<void>;
}
export declare class ObservationRecorder {
    private readonly sinks;
    private readonly trace;
    constructor(requestId: string, sinks?: ObservationSink[], route?: string);
    checkpoint(stage: string, status: ObservationStatus, message: string, details?: Record<string, unknown>): ObservationCheckpoint;
    summarize(summary: Record<string, unknown>): ObservationTrace;
    snapshot(): ObservationTrace;
    private flush;
}
export declare const createObservationRecorder: (requestId: string, sinks?: ObservationSink[], route?: string) => ObservationRecorder;
