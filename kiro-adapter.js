#!/usr/bin/env node
/**
 * Kiro Adapter - File System Based Monitoring
 * Since Kiro doesn't support CDP, monitor workspace files directly
 */

import fs from 'fs';
import path from 'path';
import { watch } from 'chokidar';

export class KiroAdapter {
  constructor(workspacePath = '.') {
    this.workspacePath = workspacePath;
    this.chatHistory = [];
    this.currentFile = null;
    this.tasks = [];
  }

  /**
   * Start monitoring Kiro workspace
   */
  start() {
    console.log('[Kiro Adapter] Starting file system monitoring...');
    
    // Monitor .kiro directory for chat history and tasks
    const kiroDir = path.join(this.workspacePath, '.kiro');
    if (fs.existsSync(kiroDir)) {
      this.watchKiroDirectory(kiroDir);
    }
    
    // Monitor workspace files for current editor content
    this.watchWorkspaceFiles();
    
    return {
      getChatHistory: () => this.chatHistory,
      getCurrentFile: () => this.currentFile,
      getTasks: () => this.tasks
    };
  }

  watchKiroDirectory(kiroDir) {
    const watcher = watch(kiroDir, { persistent: true });
    
    watcher.on('change', (filePath) => {
      console.log('[Kiro Adapter] Kiro file changed:', filePath);
      
      if (filePath.includes('chat') || filePath.includes('history')) {
        this.updateChatHistory(filePath);
      }
      
      if (filePath.includes('tasks') || filePath.includes('specs')) {
        this.updateTasks(filePath);
      }
    });
  }

  watchWorkspaceFiles() {
    const watcher = watch(this.workspacePath, {
      ignored: /node_modules|\.git/,
      persistent: true
    });
    
    watcher.on('change', (filePath) => {
      // Update current file based on most recently modified
      const stats = fs.statSync(filePath);
      if (!this.currentFile || stats.mtime > this.currentFile.mtime) {
        this.updateCurrentFile(filePath);
      }
    });
  }

  updateChatHistory(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // Parse chat history from Kiro's format
      this.chatHistory = this.parseChatContent(content);
    } catch (err) {
      console.error('[Kiro Adapter] Error reading chat history:', err.message);
    }
  }

  updateTasks(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.tasks = this.parseTaskContent(content);
    } catch (err) {
      console.error('[Kiro Adapter] Error reading tasks:', err.message);
    }
  }

  updateCurrentFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      
      this.currentFile = {
        fileName: path.basename(filePath),
        content: content,
        language: this.detectLanguage(filePath),
        mtime: stats.mtime,
        hasContent: true
      };
    } catch (err) {
      console.error('[Kiro Adapter] Error reading file:', err.message);
    }
  }

  parseChatContent(content) {
    // Parse Kiro's chat format - adapt based on actual format
    const messages = [];
    const lines = content.split('\n');
    
    let currentMessage = null;
    for (const line of lines) {
      if (line.startsWith('User:') || line.startsWith('Assistant:')) {
        if (currentMessage) messages.push(currentMessage);
        currentMessage = {
          role: line.startsWith('User:') ? 'user' : 'assistant',
          content: line.substring(line.indexOf(':') + 1).trim(),
          timestamp: new Date().toISOString()
        };
      } else if (currentMessage && line.trim()) {
        currentMessage.content += '\n' + line;
      }
    }
    
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseTaskContent(content) {
    // Parse Kiro's task/spec format
    const tasks = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
        tasks.push({
          id: tasks.length + 1,
          title: line.substring(5).trim(),
          completed: line.includes('[x]'),
          description: ''
        });
      }
    }
    
    return tasks;
  }

  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.md': 'markdown'
    };
    return langMap[ext] || 'text';
  }
}