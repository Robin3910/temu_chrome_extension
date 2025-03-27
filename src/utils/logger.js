// 通用日志函数
export function log(...args) {
    console.log('[订单采集]', ...args);
    window.postMessage({
        type: 'FROM_CONTENT_SCRIPT',
        text: args
    }, '*');
}

// 错误日志
export function logError(...args) {
    console.error('[订单采集]', ...args);
    window.postMessage({
        type: 'FROM_CONTENT_SCRIPT',
        text: args,
        level: 'error'
    }, '*');
}

// 警告日志
export function logWarn(...args) {
    console.warn('[订单采集]', ...args);
    window.postMessage({
        type: 'FROM_CONTENT_SCRIPT',
        text: args,
        level: 'warn'
    }, '*');
}

// 调试日志
export function logDebug(...args) {
    console.debug('[订单采集]', ...args);
    window.postMessage({
        type: 'FROM_CONTENT_SCRIPT',
        text: args,
        level: 'debug'
    }, '*');
} 