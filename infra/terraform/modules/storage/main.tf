locals {
  durability = {
    encrypted        = var.encrypted
    backup_enabled   = var.backup_enabled
    lifecycle_policy = var.lifecycle_policy
  }
}
