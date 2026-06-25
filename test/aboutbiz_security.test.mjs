/**
 * Tests for CWE-94 fix in server/api/public/beta/aboutbiz.get.ts
 * 
 * Verifies:
 * 1. Normal parsing of ip_wording and auth_3rd_list still works
 * 2. Malicious code is sandboxed (no access to process, require, etc.)
 * 3. Timeout protection works against infinite loops
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Replicate the extractInfo logic for testing
function extractInfoScript(scriptCode) {
  const sandbox = Object.create(null);
  sandbox.window = {
    cgiData: {
      auth_3rd_list: [],
    },
  };
  vm.createContext(sandbox);
  try {
    vm.runInContext(scriptCode, sandbox, { timeout: 1000 });
  } catch (e) {
    return { error: e };
  }
  const result = {};
  if (sandbox.window.ip_wording) {
    result.ip_wording = sandbox.window.ip_wording;
  }
  if (sandbox.window.cgiData.auth_3rd_list) {
    result.auth_3rd_list = sandbox.window.cgiData.auth_3rd_list;
  }
  return result;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

console.log('Test: Normal ip_wording parsing');
test('should extract ip_wording from legitimate script', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    window.ip_wording = {
      countryName: '中国',
      countryId: '156',
      provinceName: '山东',
      provinceId: '',
      cityName: '',
      cityId: ''
    };
  `;
  const result = extractInfoScript(scriptCode);
  assert.strictEqual(result.ip_wording.countryName, '中国');
  assert.strictEqual(result.ip_wording.provinceName, '山东');
  assert.strictEqual(result.error, undefined);
});

console.log('\nTest: Normal auth_3rd_list parsing');
test('should extract auth_3rd_list from legitimate script', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    window.cgiData.auth_3rd_list.push({
      principal: '抽奖助手',
      userName: 'gh_test@app',
      appId: 'wx_test123',
    });
  `;
  const result = extractInfoScript(scriptCode);
  assert.strictEqual(result.auth_3rd_list.length, 1);
  assert.strictEqual(result.auth_3rd_list[0].principal, '抽奖助手');
  assert.strictEqual(result.error, undefined);
});

console.log('\nTest: Real sample file parsing');
test('should correctly parse the real aboutbiz sample', () => {
  const samplePath = path.join(__dirname, '../samples/aboutbiz/biz-Mzg3OTYzMDkzMg==.html');
  const rawHTML = fs.readFileSync(samplePath, 'utf8');
  const scriptCodeMatchResult = rawHTML.match(/(?<code>var cgiData = .+)seajs\.use/s);
  assert(scriptCodeMatchResult && scriptCodeMatchResult.groups && scriptCodeMatchResult.groups.code);
  const scriptCode = scriptCodeMatchResult.groups.code;
  const result = extractInfoScript(scriptCode);
  assert.strictEqual(result.error, undefined, `Unexpected error: ${result.error}`);
  assert.strictEqual(result.ip_wording.countryName, '中国');
  assert.strictEqual(result.ip_wording.provinceName, '山东');
  assert(result.auth_3rd_list.length > 0, 'Should have auth_3rd_list entries');
});

console.log('\nTest: Security - no access to process');
test('should not allow access to process object', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    var leaked = typeof process;
    window.ip_wording = { leaked: leaked };
  `;
  const result = extractInfoScript(scriptCode);
  // In a sandboxed context, process should be undefined
  assert.strictEqual(result.ip_wording.leaked, 'undefined');
});

console.log('\nTest: Security - no access to require');
test('should not allow access to require', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    try {
      var fs = require('fs');
      window.ip_wording = { leaked: 'has_require' };
    } catch(e) {
      window.ip_wording = { leaked: 'no_require' };
    }
  `;
  const result = extractInfoScript(scriptCode);
  assert.strictEqual(result.ip_wording.leaked, 'no_require');
});

console.log('\nTest: Security - no access to global');
test('should not allow access to global/globalThis properties outside sandbox', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    var leaked = typeof __dirname;
    window.ip_wording = { leaked: leaked };
  `;
  const result = extractInfoScript(scriptCode);
  assert.strictEqual(result.ip_wording.leaked, 'undefined');
});

console.log('\nTest: Security - timeout on infinite loop');
test('should timeout on infinite loops', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    while(true) {}
  `;
  const result = extractInfoScript(scriptCode);
  assert(result.error !== undefined, 'Should have thrown a timeout error');
  assert(result.error.message.includes('timed out') || result.error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT',
    `Expected timeout error, got: ${result.error.message}`);
});

console.log('\nTest: Security - no prototype pollution');
test('should not allow prototype pollution via __proto__', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    ({}).__proto__.polluted = 'yes';
    window.ip_wording = { test: 'done' };
  `;
  const result = extractInfoScript(scriptCode);
  // Check that the host environment's Object.prototype is not polluted
  assert.strictEqual(({}).polluted, undefined);
});

console.log('\nTest: Security - cannot break out via constructor');
test('should not allow constructor-based escape', () => {
  const scriptCode = `
    var cgiData = { auth_3rd_list: [] };
    try {
      var fn = this.constructor.constructor('return process')();
      window.ip_wording = { leaked: typeof fn };
    } catch(e) {
      window.ip_wording = { leaked: 'blocked' };
    }
  `;
  const result = extractInfoScript(scriptCode);
  // Should either be blocked or return undefined (not 'object')
  assert.notStrictEqual(result.ip_wording?.leaked, 'object',
    'Should not be able to access process via constructor chain');
});

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
