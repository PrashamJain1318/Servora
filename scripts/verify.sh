#!/usr/bin/env bash
set -e

echo "=== Running Servora Monorepo Verification Suite ==="
echo "1. Checking formatting..."
pnpm format:check

echo "2. Running linter..."
pnpm lint

echo "3. Typechecking..."
pnpm typecheck

echo "4. Running tests..."
pnpm test

echo "5. Building all packages and apps..."
pnpm build

echo "=== All Verification Checks Passed! ==="
