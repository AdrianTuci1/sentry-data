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

export class MemoryObservationSink implements ObservationSink {
  public traces: ObservationTrace[] = [];

  public async write(trace: ObservationTrace): Promise<void> {
    this.traces.push(trace);
  }
}

export class ConsoleObservationSink implements ObservationSink {
  public async write(trace: ObservationTrace): Promise<void> {
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

export class ObservationRecorder {
  private readonly trace: ObservationTrace;

  constructor(
    requestId: string,
    private readonly sinks: ObservationSink[] = [],
    route?: string
  ) {
    this.trace = {
      requestId,
      route,
      createdAt: new Date().toISOString(),
      checkpoints: []
    };
  }

  public checkpoint(
    stage: string,
    status: ObservationStatus,
    message: string,
    details?: Record<string, unknown>
  ): ObservationCheckpoint {
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

  public summarize(summary: Record<string, unknown>): ObservationTrace {
    this.trace.summary = summary;
    void this.flush();
    return this.snapshot();
  }

  public snapshot(): ObservationTrace {
    return {
      ...this.trace,
      checkpoints: [...this.trace.checkpoints],
      summary: this.trace.summary ? { ...this.trace.summary } : undefined
    };
  }

  private async flush(): Promise<void> {
    await Promise.all(this.sinks.map((sink) => sink.write(this.snapshot())));
  }
}

export const createObservationRecorder = (
  requestId: string,
  sinks: ObservationSink[] = [],
  route?: string
) => new ObservationRecorder(requestId, sinks, route);
