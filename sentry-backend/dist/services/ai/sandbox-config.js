"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SANDBOX_CONFIG = void 0;
exports.SANDBOX_CONFIG = {
    // Base template to use (e.g., standard data science template)
    template: 'base',
    // File system layout definitions
    paths: {
        bronze: '/mnt/data/bronze',
        silver: '/mnt/data/silver',
        gold: '/mnt/data/gold',
        workspace: '/home/user/workspace',
    },
    // Environment variables required in the sandbox
    env: {
        DUCKDB_EXTENSION_PATH: '/usr/local/lib/duckdb',
        PYTHON_PATH: '/usr/bin/python3',
    },
    // Pre-installed tools availability
    tools: [
        'duckdb',
        'python3',
        'pandas' // If using Python for transformation
    ]
};
