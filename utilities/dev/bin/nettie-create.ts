#!/usr/bin/env bun

import { runCLI } from '../src/index.ts';

// Execute the CLI
runCLI().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
}); 