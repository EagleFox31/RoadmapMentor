variable "name" {
  description = "Provider-neutral compute workload name."
  type        = string

  validation {
    condition     = length(trimspace(var.name)) > 0
    error_message = "name must not be empty."
  }
}

variable "vcpu" {
  description = "Requested virtual CPU capacity."
  type        = number

  validation {
    condition     = var.vcpu >= 1
    error_message = "vcpu must be at least 1."
  }
}

variable "memory_mib" {
  description = "Requested memory capacity in MiB."
  type        = number

  validation {
    condition     = var.memory_mib >= 512
    error_message = "memory_mib must be at least 512."
  }
}

variable "architecture" {
  description = "CPU architecture required by the application image."
  type        = string
  default     = "amd64"

  validation {
    condition     = contains(["amd64", "arm64"], var.architecture)
    error_message = "architecture must be amd64 or arm64."
  }
}

variable "os_family" {
  description = "Operating-system family requested for the host."
  type        = string
  default     = "ubuntu-24.04"

  validation {
    condition     = length(trimspace(var.os_family)) > 0
    error_message = "os_family must not be empty."
  }
}

variable "application_port" {
  description = "Container/application port exposed on the host."
  type        = number
  default     = 5000

  validation {
    condition     = var.application_port >= 1 && var.application_port <= 65535
    error_message = "application_port must be between 1 and 65535."
  }
}

variable "public_access" {
  description = "Whether this workload is intended to receive public edge traffic."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Metadata propagated by the eventual provider implementation."
  type        = map(string)
  default     = {}
}
