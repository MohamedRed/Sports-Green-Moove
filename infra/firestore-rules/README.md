# Firestore Rules Release

This configuration owns only an existing project's default Firestore rules
release and its versioned policy. It does not create a project, database, billing
account, API, bucket or budget. `project_id` is required and has no default.

Local validation is not a cloud deployment:

```sh
terraform -chdir=infra/firestore-rules init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra/firestore-rules validate
terraform -chdir=infra/firestore-rules fmt -check
```

Before any plan/apply, obtain explicit approval for the target environment,
export and review its current rules, reconcile any production-only changes and
choose an owner-controlled state backend. Do not run a second writer alongside
Firebase CLI rules deployment. No production plan or apply has been performed.

The import block adopts `projects/<project_id>/releases/cloud.firestore`; it must
not create a competing release. A new immutable ruleset is created before the
release changes. Old rulesets use `ABANDON` so replacement does not delete their
remote versions. The active release has both deletion prevention settings. Keep
the provider lock file, but never commit credentials, state, plans or tfvars.

Record the reviewed source SHA, resulting ruleset and release update before
claiming deployment. The output `policy_sha256` binds the deployed policy to the
same canonical `firestore.rules` exercised by the local and CI tests.

The lock file includes both the Linux CI and Apple Silicon workstation package
hashes. Keep CI read-only: a missing platform hash must be reviewed and committed,
not silently learned during validation. When intentionally maintaining the lock,
use the official registry and preserve the selected provider version:

```sh
terraform -chdir=infra/firestore-rules providers lock \
  -platform=linux_amd64 -platform=darwin_arm64 registry.terraform.io/hashicorp/google
```

Review the signed-package output and lock diff before committing. Do not use an
unverified mirror, disable checksum checks, delete the lock, or upgrade providers
to repair a platform-hash omission. See the
[provider lock reference](https://developer.hashicorp.com/terraform/cli/commands/providers/lock).

Current-source authorization adds dependent-document checks to message reads;
real usage can incur additional document reads. Review this before approving a
production apply. It is not a substitute for native or physical-device testing.

References: [Firestore rule access conditions](https://firebase.google.com/docs/firestore/security/rules-conditions),
[release resource](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firebaserules_release),
[ruleset retention](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firebaserules_ruleset).
