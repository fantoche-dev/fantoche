import { LogPayload, Logger } from '@fantoche-dev/core';
export declare class LoggerManager {
    private readonly logger;
    get onInspected(): import('@fantoche-dev/core').Subscribable<string, import('@fantoche-dev/core').EventHandler<string>>;
    private readonly inspected;
    get onErrorLogged(): import('@fantoche-dev/core').SubscribableValueEvent<number>;
    private readonly errorCount;
    get onLogsChanged(): import('@fantoche-dev/core').SubscribableValueEvent<LogPayload[]>;
    private readonly logs;
    constructor(logger: Logger);
    inspect(key: string): void;
    clear(): void;
    private readonly handleLog;
}
//# sourceMappingURL=LoggerManager.d.ts.map