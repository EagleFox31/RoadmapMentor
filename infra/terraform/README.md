# RoadmapMentor Terraform foundation

This directory defines the infrastructure contract for RoadmapMentor before any cloud resources are created.

The first deployment target is AWS, but the application and reusable module interfaces are intentionally not coupled to AWS resource types. Provider-specific resources belong at the environment/provider composition boundary introduced by the provisioning work, not in application code.

## Layout

```
infra/terraform/
├── modules/
│   ├── application_stack/
│   ├── bootstrap/
│   ├── compute/
│   ├── network/
│   └── storage/
└── environments/
    ├── staging/
    └── production/
```

The four low-level modules currently act as typed infrastructure contracts. They normalize and validate intent such as compute capacity, network ingress, persistent storage and host bootstrap inputs. The `application_stack` module composes those contracts.

Provider resources are deliberately not created in this foundation issue. The AWS implementation is tracked separately so a Terraform plan from this branch cannot create infrastructure accidentally.

## Toolchain

CI currently pins Terraform CLI 1.16.5. The configuration uses standard HCL features that remain compatible with Terraform/OpenTofu-style workflows.

Locally:

```bash
cd infra/terraform
terraform fmt -check -recursive
tflint --recursive --config .tflint.hcl
```

Validate an environment without configuring a remote backend:

```bash
terraform -chdir=environments/staging init -backend=false
terraform -chdir=environments/staging validate

terraform -chdir=environments/production init -backend=false
terraform -chdir=environments/production validate
```

## Plan without apply

Copy the environment example variables outside Git or pass values through the shell/workspace:

```bash
cd infra/terraform/environments/production
cp terraform.tfvars.example terraform.tfvars
terraform init -backend=false
terraform plan
```

At the foundation stage the plan contains only module outputs because provider resources have not been introduced yet.

Do not commit `terraform.tfvars`, state files, plan files, credentials or generated `.terraform/` directories.

## Environment boundaries

Environment roots own values that can vary between deployments, including:

- provider target name;
- region/location;
- network CIDR;
- ingress sources;
- compute capacity and CPU architecture;
- persistent disk size;
- public hostname;
- tags.

Reusable modules must not contain account IDs, regions, hostnames, secrets or machine-specific paths.

## Backend boundary

No backend is declared yet. HCP Terraform remote runs/state are tracked separately. Keeping backend configuration out of reusable modules means the same HCL can be migrated to another standard Terraform backend or an OpenTofu-compatible workflow without rewriting application modules.
