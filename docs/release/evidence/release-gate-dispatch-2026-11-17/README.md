# Release Evidence Gate registration

Verified on 17 November 2026 at source `207fdd255bd90101fb2df8bbee3891e7fb3e5afd`.

- GitHub registered the workflow as active. The first push check exposed an
  uninstalled validator dependency. The corrected push check installed the locked
  dependencies, passed the template contract, and skipped the manual release job.
  [First push](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43991074750) ·
  [Corrected push](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43991279794)
- A manual validation of the incomplete manifest correctly rejected the missing
  iPhone and Android device runs and pending safety records. GitHub skipped the
  export, provider configuration, and Stripe steps.
  [Manual negative check](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43991326599)

The device runs, sanitized export, and successful production gate are pending.
