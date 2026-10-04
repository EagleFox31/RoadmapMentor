variable "project_name" {
  description = "Logical product name."
  type        = string
}

variable "environment" {
  description = "Deployment environment name."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "environment must use lowercase letters, digits and hyphens."
  }
}

variable "deployment_target" {
  description = "Provider/location metadata. Provider resources are composed outside application modules."
  type = object({
    provider_name = string
    region        = string
    account_id    = optional(string)
  })
}

variable "network" {
  type = object({
    cidr_block = string
    ingress_rules = list(object({
      name        = string
      protocol    = string
      from_port   = number
      to_port     = number
      cidr_blocks = list(string)
      purpose     = string
    }))
    egress_rules = list(object({
      name        = string
      protocol    = string
      from_port   = number
      to_port     = number
      cidr_blocks = list(string)
      purpose     = string
    }))
  })
}

variable "compute" {
  type = object({
    vcpu             = number
    memory_mib       = number
    architecture     = string
    os_family        = string
    application_port = number
    public_access    = bool
  })
}

variable "storage" {
  type = object({
    mount_path       = string
    size_gib         = number
    encrypted        = bool
    backup_enabled   = bool
    lifecycle_policy = string
  })
}

variable "bootstrap" {
  type = object({
    runtime_directory    = string
    compose_project_name = string
    container_runtime    = string
  })
}

variable "hostname" {
  description = "Public hostname intent. DNS is implemented separately."
  type        = string

  validation {
    condition     = length(trimspace(var.hostname)) > 0
    error_message = "hostname must not be empty."
  }
}

variable "tags" {
  description = "Common metadata passed to provider implementations."
  type        = map(string)
  default     = {}
}
