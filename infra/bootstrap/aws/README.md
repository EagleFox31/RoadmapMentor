# AWS bootstrap for HCP Terraform

This bootstrap exists because HCP Terraform needs an AWS trust relationship before Terraform can authenticate to AWS.

It is intentionally isolated from the provider-agnostic Terraform application modules:

- CloudFormation is used only for the AWS-specific trust bootstrap.
- HCP Terraform receives temporary credentials through OIDC.
- No long-lived AWS access keys are stored in GitHub or HCP Terraform.
- The application infrastructure remains managed by Terraform.

## Current AWS account

The HCP Terraform OIDC provider `https://app.terraform.io` has already been created manually in the current AWS account.

When creating the stack, keep:

```text
CreateOidcProvider = false
```

For a fresh AWS account where the provider does not exist, set it to `true`.

## Deploy from AWS CloudFormation

Create a stack from `infra/bootstrap/aws/hcp-terraform-oidc.yaml`.

RoadmapMentor production parameters:

```text
CreateOidcProvider       = false
HcpTerraformOrganization = trigenys-group
HcpTerraformProject      = RoadmapMentor
HcpTerraformWorkspace    = roadmapmentor-production
HcpTerraformAudience     = aws.workload.identity
```

The stack creates:

- `roadmapmentor-tfc-plan`
- `roadmapmentor-tfc-apply`

The trust policies are restricted to the exact HCP Terraform organization, project, workspace and run phase.

The roles intentionally have no provider permissions yet. Issue #28 attaches least-privilege AWS permissions once the exact resources are defined.

## HCP Terraform variables

Copy the CloudFormation outputs into the workspace as environment variables:

```text
TFC_AWS_PROVIDER_AUTH=true
TFC_AWS_PLAN_ROLE_ARN=<PlanRoleArn output>
TFC_AWS_APPLY_ROLE_ARN=<ApplyRoleArn output>
```

Do not add `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.
