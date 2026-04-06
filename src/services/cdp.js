/**
 * Chrome DevTools Protocol (CDP) connection service
 */
import http from 'http';
import { WebSocket } from 'ws';
import { CDP_CALL_TIMEOUT, HTTP_TIMEOUT } from '../utils/constants.js';

/**
 * Fetch JSON from a CDP endpoint
 * Tries both 127.0.0.1 and localhost for cross-platform compatibility
 * @param {number} port - The port to fetch from
 * @param {string} path - The path to fetch (default: /json/list)
 * @returns {Promise<any>} - Parsed JSON response
 */
export function fetchCDPTargets(port, path = '/json/list') {
  // For Kiro IDE: Try WebSocket-only CDP implementation first
  if (port === 9222) {
    return fetchKiroCDPTargets(port).catch(() => {
      // Fallback to standard HTTP CDP
      return fetchFromHost('127.0.0.1', port, path)
        .catch(() => fetchFromHost('localhost', port, path));
    });
  }
  
  // Standard CDP implementation for other ports
  return fetchFromHost('127.0.0.1', port, path)
    .catch(() => fetchFromHost('localhost', port, path));
}

/**
 * Fetch CDP targets from Kiro IDE using WebSocket-only implementation
 * @param {number} port - The port to connect to
 * @returns {Promise<any>} - Mock targets array for Kiro
 */
async function fetchKiroCDPTargets(port) {
  // Check if Kiro WebSocket endpoint is accessible
  const wsUrl = `ws://127.0.0.1:${port}/devtools/browser`;
  
  try {
    // Try to connect to the WebSocket to verify it exists
    const testWs = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        testWs.terminate();
        reject(new Error('Kiro WebSocket connection timeout'));
      }, 2000);
      
      testWs.on('open', () => {
        clearTimeout(timeout);
        testWs.terminate();
        
        // Return mock targets that represent Kiro IDE
        resolve([
          {
            id: 'kiro-main-window',
            title: 'Kiro IDE - Main Window',
            type: 'page',
            url: 'vscode-file://kiro-ide',
            webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/kiro-main`
          },
          {
            id: 'kiro-agent-webview',
            title: 'Kiro Agent - Chat Interface',
            type: 'webview',
            url: 'kiroagent://chat',
            webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/kiro-agent`
          }
        ]);
      });
      
      testWs.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Kiro WebSocket connection failed: ${err.message}`));
      });
    });
  } catch (err) {
    throw new Error(`Failed to connect to Kiro CDP: ${err.message}`);
  }
}

/**
 * Fetch JSON from a specific host
 * @param {string} host - The host to connect to
 * @param {number} port - The port to fetch from
 * @param {string} path - The path to fetch
 * @returns {Promise<any>} - Parsed JSON response
 */
function fetchFromHost(host, port, path) {
  return new Promise((resolve, reject) => {
    const url = `http://${host}:${port}${path}`;
    
    const req = http.get(url, { timeout: HTTP_TIMEOUT }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    });
    
    req.on('error', (err) => reject(new Error(`Failed to fetch ${url}: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * @typedef {Object} PendingCall
 * @property {Function} resolve - Promise resolve function
 * @property {Function} reject - Promise reject function
 * @property {NodeJS.Timeout} timeoutId - Timeout handle for cleanup
 */

/**
 * @typedef {Object} CDPConnection
 * @property {WebSocket} ws - WebSocket connection
 * @property {Array} contexts - Execution contexts
 * @property {number|null} rootContextId - Root context ID
 * @property {Function} call - Make a CDP call
 * @property {Function} close - Close the connection
 */

/**
 * Create a CDP connection to a target
 * @param {string} wsUrl - WebSocket debugger URL
 * @returns {Promise<CDPConnection>} - CDP connection object
 */
export function connectToCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let idCounter = 1;
    /** @type {Map<number, PendingCall>} */
    const pendingCalls = new Map();
    const contexts = [];
    let rootContextId = null;
    let isConnected = false;
    
    /**
     * Clear all pending calls and their timeouts
     * @param {Error} error - Error to reject pending calls with
     */
    function clearAllPendingCalls(error) {
      for (const [id, pending] of pendingCalls) {
        // Clear the timeout to prevent memory leak
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pending.reject(error);
      }
      pendingCalls.clear();
    }
    
    ws.on('message', (rawMsg) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        
        if (msg.method === 'Runtime.executionContextCreated') {
          const ctx = msg.params.context;
          contexts.push(ctx);
          if (rootContextId === null || ctx.auxData?.isDefault) {
            rootContextId = ctx.id;
          }
        }
        
        if (msg.method === 'Runtime.executionContextDestroyed') {
          const ctxId = msg.params.executionContextId;
          const idx = contexts.findIndex(c => c.id === ctxId);
          if (idx !== -1) contexts.splice(idx, 1);
          if (rootContextId === ctxId) {
            rootContextId = contexts.length > 0 ? contexts[0].id : null;
          }
        }
        
        if (msg.method === 'Runtime.executionContextsCleared') {
          contexts.length = 0;
          rootContextId = null;
        }
        
        if (msg.id !== undefined && pendingCalls.has(msg.id)) {
          const pending = pendingCalls.get(msg.id);
          
          // Clear the timeout since we got a response
          if (pending.timeoutId) {
            clearTimeout(pending.timeoutId);
          }
          
          pendingCalls.delete(msg.id);
          
          if (msg.error) {
            pending.reject(new Error(`CDP Error: ${msg.error.message} (code: ${msg.error.code})`));
          } else {
            pending.resolve(msg.result);
          }
        }
      } catch (e) {
        console.error('[CDP] Failed to parse message:', e.message);
      }
    });
    
    ws.on('open', async () => {
      isConnected = true;
      console.log(`[CDP] Connected to ${wsUrl}`);
      
      const cdp = {
        ws,
        contexts,
        get rootContextId() { return rootContextId; },
        
        /**
         * Make a CDP call
         * @param {string} method - CDP method name
         * @param {object} params - Method parameters
         * @returns {Promise<any>} - Call result
         */
        call(method, params = {}) {
          return new Promise((res, rej) => {
            if (!isConnected) {
              rej(new Error('CDP connection is closed'));
              return;
            }
            
            const id = idCounter++;
            
            // Set up timeout with cleanup
            const timeoutId = setTimeout(() => {
              if (pendingCalls.has(id)) {
                pendingCalls.delete(id);
                rej(new Error(`CDP call timeout: ${method}`));
              }
            }, CDP_CALL_TIMEOUT);
            
            // Store pending call with timeout reference for cleanup
            pendingCalls.set(id, { resolve: res, reject: rej, timeoutId });
            
            try {
              ws.send(JSON.stringify({ id, method, params }));
            } catch (sendError) {
              // Clean up on send failure
              clearTimeout(timeoutId);
              pendingCalls.delete(id);
              rej(new Error(`Failed to send CDP call: ${sendError.message}`));
            }
          });
        },
        
        /**
         * Close the CDP connection
         */
        close() {
          isConnected = false;
          clearAllPendingCalls(new Error('CDP connection closed'));
          ws.terminate();
        }
      };
      
      try {
        await cdp.call('Runtime.enable', {});
        await new Promise(r => setTimeout(r, 300));
        console.log(`[CDP] Runtime enabled, found ${contexts.length} context(s)`);
        resolve(cdp);
      } catch (err) {
        cdp.close();
        reject(err);
      }
    });
    
    ws.on('error', (err) => {
      console.error(`[CDP] WebSocket error: ${err.message}`);
      isConnected = false;
      reject(err);
    });
    
    ws.on('close', () => {
      console.log('[CDP] Connection closed');
      isConnected = false;
      clearAllPendingCalls(new Error('CDP connection closed'));
    });
  });
}
