# Rules Validation Lock Portability

Checked 5 November 2026. The a37cdbf web job passes the separate current-source
chat service tests, then fails Terraform validation on Linux: installation
verifies the signed archive, but the read-only lock has only the workstation's
unpacked-package hash. The actual failing job and selected lines are retained.

`terraform providers lock -platform=linux_amd64` retrieves the same Google
provider 7.46.2 from its official registry, reports the package as signed by
HashiCorp and adds one Linux `h1` hash. Every previous hash, the provider version
and the constraint stay unchanged. There is no provider upgrade, unchecked mirror,
cache bypass, lock deletion or removal of `-lockfile=readonly`.

Local Terraform 1.14.0 on Apple Silicon passes read-only initialization,
validation and formatting checks. The Linux recheck must still execute in CI;
local validation alone does not accept it. No cloud credentials, plan, apply,
production rules update, new media or release acceptance is involved. Native
application sources and the iPhone gate are unchanged by this correction.

The regression contract requires both package hashes and the original actual
read-only validation commands. This is internal preparation evidence, not a new
partner-facing technical status note or a changed historical user-flow result.

References: [provider lock](https://developer.hashicorp.com/terraform/cli/commands/providers/lock),
[dependency checksum verification](https://developer.hashicorp.com/terraform/language/files/dependency-lock).
