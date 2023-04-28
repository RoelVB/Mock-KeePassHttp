
export type LogFunction = (level: 'verbose'|'info'|'warn'|'error', msg: string, ...optionalParams: any[])=>void;
let _logger: LogFunction | undefined;

export function setLogger(logger: LogFunction)
{
    _logger = logger;
}

export const colors = {
    Reset: '\x1b[0m',
    Red: '\x1b[31m',
    Green: '\x1b[32m',
    Yellow: '\x1b[33m',
    Blue: '\x1b[34m',
};

export const log: LogFunction = (level, msg, ...optionalParams)=>
{
    if(_logger)
        _logger(level, msg, ...optionalParams);
    else
    {
        let prefixColor = colors.Blue;
        if(level === 'error')
            prefixColor = colors.Red;
        else if(level === 'warn')
            prefixColor = colors.Yellow;
        else if(level === 'info')
            prefixColor = colors.Green;

        const now = new Date();

        console.log(`[${now.toLocaleString()}] [${prefixColor}${level}${colors.Reset}] ${msg}`, ...optionalParams);
    }
};
