output "deployment_contract" {
  description = "Provider-neutral contract consumed by provider-specific provisioning."
  value = {
    project_name      = var.project_name
    environment       = var.environment
    deployment_target = var.deployment_target
    hostname          = var.hostname
    network           = module.network.spec
    compute           = module.compute.spec
    storage           = module.storage.spec
    bootstrap         = module.bootstrap.spec
    tags              = local.common_tags
  }
}
