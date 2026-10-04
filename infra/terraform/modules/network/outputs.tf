output "spec" {
  description = "Normalized provider-neutral network contract."
  value = {
    name          = var.name
    cidr_block    = var.cidr_block
    ingress_rules = local.normalized_ingress_rules
    tags          = var.tags
  }
}
