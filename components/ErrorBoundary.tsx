import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: "20px", color: "white", background: "#333" }}>
                    <h1>Something went wrong.</h1>
                    <p style={{ color: "#ff6b6b", fontFamily: "monospace" }}>
                        {this.state.error && this.state.error.toString()}
                    </p>
                    <button onClick={() => window.location.reload()} style={{ padding: "10px", marginTop: "10px" }}>
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
