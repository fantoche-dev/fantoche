import { LogPayload, Logger } from '@fantoche/core';
export declare class LoggerManager {
    private readonly logger;
    get onInspected(): import('@fantoche/core').Subscribable<string, import('@fantoche/core').EventHandler<string>>;
    private readonly inspected;
    get onErrorLogged(): import('@fantoche/core').SubscribableValueEvent<number>;
    private readonly errorCount;
    get onLogsChanged(): import('@fantoche/core').SubscribableValueEvent<LogPayload[]>;
    private readonly logs;
    constructor(logger: Logger);
    inspect(key: string): void;
    clear(): void;
    private readonly handleLog;
}
//# sourceMappingURL=LoggerManager.d.ts.map