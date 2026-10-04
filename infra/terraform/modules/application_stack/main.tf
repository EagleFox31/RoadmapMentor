locals {
  name = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

module "network" {
  source = "../network"

  name          = "${local.name}-network"
  cidr_block    = var.network.cidr_block
  ingress_rules = var.network.ingress_rules
  egress_rules  = var.network.egress_rules
  tags          = local.common_tags
}

module "compute" {
  source = "../compute"

  name             = "${local.name}-app"
  vcpu             = var.compute.vcpu
  memory_mib       = var.compute.memory_mib
  architecture     = var.compute.architecture
  os_family        = var.compute.os_family
  application_port = var.compute.application_port
  public_access    = var.compute.public_access
  tags             = local.common_tags
}

module "storage" {
  source = "../storage"

  name             = "${local.name}-data"
  mount_path       = var.storage.mount_path
  size_gib         = var.storage.size_gib
  encrypted        = var.storage.encrypted
  backup_enabled   = var.storage.backup_enabled
  lifecycle_policy = var.storage.lifecycle_policy
  tags             = local.common_tags
}

module "bootstrap" {
  source = "../bootstrap"

  runtime_directory    = var.bootstrap.runtime_directory
  compose_project_name = var.bootstrap.compose_project_name
  container_runtime    = var.bootstrap.container_runtime
  application_port     = var.compute.application_port
  persistent_mounts = [
    {
      name       = module.storage.spec.name
      mount_path = module.storage.spec.mount_path
    }
  ]
}
