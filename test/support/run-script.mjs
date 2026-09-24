// Runs one of the lab's classic scripts (an IIFE that talks to `window` / `Lab`) in a fresh sandbox, so its pure
// parts can be tested without a browser. `globals` become the sandbox's globals; `window` is the sandbox itself.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function runScript(path, globals = {}) {
  const sandbox = vm.createContext({ ...globals });
  sandbox.window = sandbox;
  const code = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  vm.runInContext(code, sandbox, { filename: path });
  return sandbox;
}
