#!/usr/bin/env node
/** `trainhorn-calc` command. See `trainhorn-calc --help`. */
import { main } from '../src/cli.js';

process.exitCode = main(process.argv.slice(2));
