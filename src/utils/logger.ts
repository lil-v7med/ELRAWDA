export interface LogEntry {
  timestamp: string;
  type: 'auth' | 'db' | 'network' | 'exception';
  message: string;
  details?: any;
}

const isProduction = (import.meta as any).env.PROD;

class CentralLogger {
  private logs: LogEntry[] = [];

  log(type: LogEntry['type'], message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };
    
    this.logs.push(entry);

    // Disable general debug logging in production builds
    if (!isProduction) {
      console.log(`[LOGGER][${type.toUpperCase()}] ${message}`, details || '');
    } else {
      // In production, only report serious issues (db failures or uncaught exceptions) to console.error
      if (type === 'exception' || type === 'db') {
        console.error(`[SYSTEM ERROR][${type.toUpperCase()}] ${message}`, details || '');
      }
    }
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new CentralLogger();
