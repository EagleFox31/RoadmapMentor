variable "name" {
  description = "Provider-neutral persistent storage name."
  type        = string
}

variable "mount_path" {
  description = "Mount point expected by the host/runtime."
  type        = string

  validation {
    condition     = startswith(var.mount_path, "/")
    error_message = "mount_path must be an absolute path."
  }
}

variable "size_gib" {
  description = "Requested persistent capacity in GiB."
  type        = number

  validation {
    condition     = var.size_gib >= 1
    error_message = "size_gib must be at least 1."
  }
}

variable "encrypted" {
  description = "Whether persistent data must be encrypted at rest."
  type        = bool
  default     = true

  validation {
    condition     = var.encrypted
    error_message = "RoadmapMentor persistent storage must remain encrypted."
  }
}

variable "backup_enabled" {
  description = "Whether this data set must participate in automated backups."
  type        = bool
  default     = true
}

variable "lifecycle_policy" {
  description = "Intent for data retention when compute is replaced."
  type        = string
  default     = "retain"

  validation {
    condition     = contains(["retain", "replaceable"], var.lifecycle_policy)
    error_message = "lifecycle_policy must be retain or replaceable."
  }
}

variable "tags" {
  description = "Metadata propagated by the eventual provider implementation."
  type        = map(string)
  default     = {}
}
