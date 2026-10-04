variable "runtime_directory" {
  description = "Directory in which the host runtime is managed."
  type        = string

  validation {
    condition     = startswith(var.runtime_directory, "/")
    error_message = "runtime_directory must be an absolute path."
  }
}

variable "compose_project_name" {
  description = "Stable Docker Compose project name."
  type        = string
  default     = "roadmapmentor"
}

variable "application_port" {
  description = "RoadmapMentor application port."
  type        = number
  default     = 5000
}

variable "persistent_mounts" {
  description = "Persistent mount points that bootstrap must make available."
  type = list(object({
    name       = string
    mount_path = string
  }))

  validation {
    condition = alltrue([
      for mount in var.persistent_mounts :
      length(trimspace(mount.name)) > 0 && startswith(mount.mount_path, "/")
    ])
    error_message = "Every persistent mount needs a name and absolute mount_path."
  }
}

variable "container_runtime" {
  description = "Container runtime contract expected from bootstrap."
  type        = string
  default     = "docker"

  validation {
    condition     = contains(["docker"], var.container_runtime)
    error_message = "The current RoadmapMentor runtime contract supports docker."
  }
}
