import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger.js';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.log('exception', `Unhandled React Component Crash: ${error.message}`, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isArabic = document.documentElement.getAttribute('lang') === 'ar' || window.location.pathname.includes('/ar');
      
      return (
        <div className="bg-gradient-welcome min-h-screen relative flex items-center justify-center p-6 text-slate-800 dark:text-slate-200">
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[10%] left-[20%] w-64 h-64 rounded-full bg-rose-500/10 dark:bg-rose-500/5 blur-[70px] float-slow"></div>
            <div className="absolute bottom-[20%] right-[20%] w-80 h-80 rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-[80px] float-slow" style={{ animationDelay: '-3s' }}></div>
          </div>

          <div className="relative z-10 w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-6 shadow-md">
              <ShieldAlert size={36} />
            </div>

            <h2 className="font-poppins font-extrabold text-xl text-rose-600 dark:text-rose-400 mb-2">
              {isArabic ? 'حدث خطأ في النظام' : 'System Error Occurred'}
            </h2>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              {isArabic 
                ? 'فشل الاتصال بخوادم قاعدة البيانات أو تعذر تحميل بعض مكونات النظام. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.'
                : 'Connection to the database services failed or a system component crashed. Please check your internet connection and try again.'}
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-950/30 text-[10px] font-mono text-left overflow-x-auto text-rose-500 border border-slate-200/50 dark:border-slate-800/50 max-h-24">
                <strong>Error:</strong> {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleRetry}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-lg transition-all flex justify-center items-center gap-2 font-poppins"
            >
              <RefreshCw size={14} />
              <span>{isArabic ? 'إعادة محاولة الاتصال' : 'Retry Connection'}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
