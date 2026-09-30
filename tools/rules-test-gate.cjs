const path = require('node:path');

// Parse only Node's final TAP totals, never earlier/nested diagnostics. Missing,
// truncated, contradictory or non-integer reports fail closed.
function assessRules(tapText) {
  const status = { total:0, passed:0, failed:0, cancelled:0, skipped:0, todo:0, ok:false };
  if (typeof tapText !== 'string') return status;
  const match = tapText.match(/(?:^|\n)# tests (\d+)\r?\n# suites (\d+)\r?\n# pass (\d+)\r?\n# fail (\d+)\r?\n# cancelled (\d+)\r?\n# skipped (\d+)\r?\n# todo (\d+)\r?\n# duration_ms (\d+(?:\.\d+)?)\s*$/);
  if (!match) return status;
  const numbers = match.slice(1,8).map(Number);
  if (numbers.some(n=>!Number.isSafeInteger(n) || n<0) || !Number.isFinite(Number(match[8]))) return status;
  const [total,,passed,failed,cancelled,skipped,todo] = numbers;
  Object.assign(status,{total,passed,failed,cancelled,skipped,todo});
  // Node treats a file containing no test() calls as one successful file test.
  // Such a synthetic root subtest must not certify coverage of that rule file.
  const syntheticFile = tapText.split(/\r?\n/).some(line=>{
    const title = /^# Subtest: (.+)$/.exec(line)?.[1];
    return title && (path.isAbsolute(title) || path.win32.isAbsolute(title) || /(?:^|[\\/])[^\\/]+\.(?:[cm]?js|tsx?)$/.test(title));
  });
  status.ok = !syntheticFile && total>0 && passed===total && failed===0 && cancelled===0 && skipped===0 && todo===0;
  return status;
}

module.exports = { assessRules };
