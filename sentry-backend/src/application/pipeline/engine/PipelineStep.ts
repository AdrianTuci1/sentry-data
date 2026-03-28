import { PipelineContext, PipelineResult } from '../types';

export interface PipelineStep {
    getName(): string;
    execute(ctx: PipelineContext, result: Partial<PipelineResult>): Promise<void>;
}

export abstract class BasePipelineStep implements PipelineStep {
    abstract getName(): string;
    abstract execute(ctx: PipelineContext, result: Partial<PipelineResult>): Promise<void>;

    protected log(message: string) {
        console.log(`[${this.getName()}] ${message}`);
    }
}
