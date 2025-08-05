export class SequentialProcessor {
    private lastOperation: Promise<unknown> = Promise.resolve();

    public async process<T>(task: () => Promise<T>): Promise<T> {
        // Chain the new task to the end of the current sequence
        const resultPromise = this.lastOperation.then(async () => {
            // Execute the actual task
            return await task();
        }).catch(async (error) => {
            console.error("Error in sequential operation, allowing queue to continue:", error);
            return await task();
        });

        // Update lastOperation to point to the promise of the current task's completion
        this.lastOperation = resultPromise.then(() => { }).catch(() => { }); // Ensure it's a settled promise for the next link

        return resultPromise;
    }
}