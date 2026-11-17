# Completed native matrix at source 964

Run `42273698362`, job `128084475317`, source
`9640d8b65db123e753d1577eebd2e67595f16058` completes successfully. The separate
workflow conclusion is `cancelled`, not success. This record accepts only that
completed source-bound native job, not the whole workflow or current head.

The original archive is artifact `13535290752`: 33,157,663 bytes, SHA-256
`3d9b16b06689f3fe17bd757be2e2b4e2a08b7be9780504467af6f5df2fb04f4b`.
The downloaded ZIP matches the provider metadata exactly. An earlier local
download ran out of temporary disk space and is retained separately as an
incomplete download; it is not a native test or device-copy failure.

Verified contents:

- 354 ordinary cases: 299 passed, 55 intentionally skipped, zero failed. The
  complete transcript and generated XML agree, including every case identity.
- All 37 isolated replay groups pass. Their 32 instrumentation transcripts
  contain all 40 expected native cases and the installation guard markers.
- All 17 primary evidence-copy receipts complete successfully for the same
  isolated run. Cleanup is not substituted for a missing primary copy.
- Both stages bind the same four APK hashes and original guarded device receipt.
- The administrator client and Firestore client close. The test packages,
  background/store/launcher state and temporary device administrator are restored.
- Passive observation verifies emulator exit without requesting process signals
  or extra device commands. Capture observations return successfully.

The retained raw members have independent byte counts and checksums and remain
linked to the exact original archive. No new media is published. This run uses
synthetic accounts and local services, not live payments, push delivery or a
physical trip. Existing physical, operational, safety and emergency-handoff
requirements remain open on both release platforms.

This successful observation does not establish the cause of earlier timeouts,
focus failures, DNS observations or interrupted copies. It predates the later
ordinary-process-stop preparation change, which is not accepted by this record.
The later iPhone ten-of-eleven failure remains a separate failure.

Validation: `node --test tests/android-matrix-preparation.test.mjs`. Resealed
negative cases reject unsupported workflow/current-head/physical acceptance,
failed replay groups, missing restoration and altered original-archive identity.
