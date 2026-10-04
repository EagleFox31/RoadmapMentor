output "spec" {
  description = "Normalized provider-neutral host bootstrap contract."
  value = {
    runtime_directory    = var.runtime_directory
    compose_project_name = var.compose_project_name
    application_port     = var.application_port
    persistent_mounts    = local.persistent_mounts
    container_runtime    = var.container_runtime
  }
}
