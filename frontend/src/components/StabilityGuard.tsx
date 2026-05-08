// Refactor: fully typed StabilityGuard (removed @ts-nocheck)

/**
 * StabilityGuard.jsx - Error Boundary Component
 * 
 * Implements the "Safe Mode" pattern to prevent full app crashes.
 * If the Universal Game Room crashes, users are redirected to a stable fallback.
 */
import React, { Component } from 'react';

interface StabilityGuardProps {
  children?: React.ReactNode;
}

interface StabilityGuardState {
  hasError: boolean;
  errorInfo: React.ErrorInfo | null;
}

class StabilityGuard extends Component<StabilityGuardProps, StabilityGuardState> {
  state: StabilityGuardState = {
    hasError: false,
    errorInfo: null,
  };

  static getDerivedStateFromError(_error: Error): Partial<StabilityGuardState> {
    // Update state so the next render shows fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('🔴 Stability Breach Detected:', error);
    console.error('Error Info:', errorInfo);

    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Re-sync to Master Copy (reload the component)
    this.setState({ hasError: false, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="safe-mode-ui" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            padding: '3rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              fontSize: '2.5rem', 
              marginBottom: '1rem',
              color: '#f39c12'
            }}>
              🛡️ System Stabilized (Safe Mode)
            </h1>
            <p style={{ 
              fontSize: '1.1rem', 
              marginBottom: '2rem',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              The game logic encountered an error, but your session is protected.
              <br />
              Your credits and progress are safe.
            </p>
            
            {this.state.errorInfo && (
              <details style={{ 
                marginBottom: '2rem',
                textAlign: 'left',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Technical Details
                </summary>
                <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <button 
              onClick={this.handleReset}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'transform 0.2s',
                marginRight: '1rem'
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              🔄 Re-sync Master Copy
            </button>
            
            <button 
              onClick={() => { window.location.href = '/games'; }}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              ← Back to Game Arena
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StabilityGuard;
