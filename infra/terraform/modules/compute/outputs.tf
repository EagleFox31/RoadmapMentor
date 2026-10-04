output "spec" {
  description = "Normalized provider-neutral compute contract."
  value = {
    name             = var.name
    capacity         = local.capacity
    architecture     = var.architecture
    os_family        = var.os_family
    application_port = var.application_port
    public_access    = var.public_access
    tags             = var.tags
  }
}
