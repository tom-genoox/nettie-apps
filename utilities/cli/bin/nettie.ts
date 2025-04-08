#!/usr/bin/env bun

import { runNettieCLI } from '../src/cli.ts';

// Execute the CLI
runNettieCLI().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
}); 