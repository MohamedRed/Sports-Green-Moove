const mode = process.argv[2];
process.stdout.write(mode === 'failed-summary' ? '55 files pulled, 0 skipped.\n' : 'file transfer output\n');
process.stderr.write(`sync diagnostic ${process.env.SGM_TEST_REDACT_ME}\n`);
if (mode === 'failed-summary') process.exitCode = 1;
if (mode === 'signal') process.kill(process.pid, 'SIGTERM');
