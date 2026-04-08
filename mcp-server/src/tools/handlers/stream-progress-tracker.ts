/**
 * StreamProgressTracker - Tracks coordinator agent output and writes progress to a Markdown file.
 */

import { writeFileSync } from 'node:fs';

export class StreamProgressTracker {
  private buffer = '';
  private lineCount = 0;

  constructor(
    private readonly progressFile: string,
    private readonly paneId: string,
  ) {
    writeFileSync(this.progressFile, `# Progress: ${this.paneId}\n\n`);
  }

  /**
   * Feed raw stdout/stderr text from the subprocess.
   * Accumulates lines and periodically flushes a summary to the progress file.
   */
  feed(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    this.lineCount += lines.length;

    if (this.lineCount > 0 && this.lineCount % 10 < lines.length) {
      this.flush();
    }
  }

  flush(): void {
    const summary = [
      `# Progress: ${this.paneId}`,
      '',
      `Lines processed: ${this.lineCount}`,
      '',
    ].join('\n');
    writeFileSync(this.progressFile, summary);
  }
}
