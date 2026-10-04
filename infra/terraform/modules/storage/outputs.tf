output "spec" {
  description = "Normalized provider-neutral persistent-storage contract."
  value = {
    name       = var.name
    mount_path = var.mount_path
    size_gib   = var.size_gib
    durability = local.durability
    tags       = var.tags
  }
}
