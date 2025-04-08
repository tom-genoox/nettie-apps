#!/usr/bin/env bun

import { runCLI } from '../src/index.ts';

// Check if this script is being run directly or being imported
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

// If run directly, execute the CLI
if (isMainModule) {
  runCLI().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

// Export the runCLI function for use in other scripts
export { runCLI }; 