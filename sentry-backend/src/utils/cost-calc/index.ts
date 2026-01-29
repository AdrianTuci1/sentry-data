export const costCalc = {
    // Example rates (per second)
    rates: {
        'modal-gpu-a10g': 0.0003, // Mock rate
        'e2b-sandbox': 0.00005,
        'aws-step-functions': 0.000001, // per transition mostly, but roughly
    },

    calculateRunCost: (resourceType: string, durationSeconds: number): number => {
        const rate = costCalc.rates[resourceType as keyof typeof costCalc.rates] || 0;
        return rate * durationSeconds;
    },

    estimateProjectMonthToDate: (currentCost: number, pendingRuns: any[]): number => {
        // Add pending runs estimation
        let estimated = currentCost;
        pendingRuns.forEach(run => {
            // Mock logic: assume average 60s run if unknown
            estimated += costCalc.calculateRunCost(run.resourceType, run.duration || 60);
        });
        return parseFloat(estimated.toFixed(4));
    }
};
