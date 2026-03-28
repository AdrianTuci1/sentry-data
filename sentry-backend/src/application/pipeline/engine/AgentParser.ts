export class AgentParser {
    public static extractStdout(logs: string): string {
        let stdout = logs;
        if (stdout.includes('--- AGENT_EXECUTION_STDOUT ---')) {
            stdout = stdout.split('--- AGENT_EXECUTION_STDOUT ---').pop() || '';
        }
        if (stdout.includes('--- STDOUT ---')) {
            stdout = stdout.split('--- STDOUT ---')[1];
        }
        return stdout;
    }

    public static parseResult(stdout: string, taskName: string): any {
        const resultMatch = [...stdout.matchAll(/AGENT_RESULT:(.*?)(?=\nAGENT_|$)/gs)];
        if (resultMatch.length === 0) return null;

        const raw = resultMatch[resultMatch.length - 1][1].trim();
        try { return JSON.parse(raw); } catch (e) {
            const json = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (json) {
                try { return JSON.parse(json[0]); } catch (e2: any) {
                    console.warn(`[AgentParser] Failed to parse AGENT_RESULT for ${taskName}: ${e2.message}`);
                }
            }
        }
        return null;
    }

    public static estimateTokens(logs: string, hasCache: boolean): number {
        const tokenMatch = logs.match(/AGENT_TOKENS:(.*?)(?=\n|$)/);
        if (tokenMatch && tokenMatch[1]) {
            try {
                const usage = JSON.parse(tokenMatch[1].trim());
                if (usage.total_token_count) return usage.total_token_count;
            } catch (e) { }
        }
        return hasCache ? 0 : Math.ceil(logs.length / 4);
    }
}
