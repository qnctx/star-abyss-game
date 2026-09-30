process.env.BENCH_URL='http://127.0.0.1:4180/star-abyss.html?testLab=1&test=1&expeditionDebug=1';
process.env.BENCH_OUT=process.argv[2]||'artifacts/r2-candidate-performance';
require('./playtest-r2-benchmark.cjs');
