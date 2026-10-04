variable "provider_name" {
  description = "Infrastructure provider target. AWS is the first implementation, not an application dependency."
  type        = string
  default     = "aws"

  validation {
    condition     = length(trimspace(var.provider_name)) > 0
    error_message = "provider_name must not be empty."
  }
}

variable "deployment_region" {
  description = "Provider region/location for this environment."
  type        = string

  validation {
    condition     = length(trimspace(var.deployment_region)) > 0
    error_message = "deployment_region must not be empty."
  }
}

variable "account_id" {
  description = "Optional provider account/project identifier supplied by workspace configuration."
  type        = string
  default     = null
  nullable    = true
}

variable "hostname" {
  description = "Public hostname intent for this environment."
  type        = string

  validation {
    condition     = length(trimspace(var.hostname)) > 0
    error_message = "hostname must not be empty."
  }
}

variable "network_cidr" {
  description = "CIDR reserved for the RoadmapMentor network."
  type        = string

  validation {
    condition     = can(cidrhost(var.network_cidr, 0))
    error_message = "network_cidr must be a valid IPv4 CIDR."
  }
}

variable "allowed_http_cidrs" {
  description = "Sources allowed to reach the HTTP/HTTPS edge."
  type        = list(string)

  validation {
    condition = length(var.allowed_http_cidrs) > 0 && alltrue([
      for cidr in var.allowed_http_cidrs : can(cidrhost(cidr, 0))
    ])
    error_message = "allowed_http_cidrs must contain at least one valid CIDR."
  }
}

variable "compute_vcpu" {
  description = "Requested compute vCPU capacity."
  type        = number
  default     = 2
}

variable "compute_memory_mib" {
  description = "Requested compute memory in MiB."
  type        = number
  default     = 2048
}

variable "compute_architecture" {
  description = "Requested CPU architecture."
  type        = string
  default     = "amd64"

  validation {
    condition     = contains(["amd64", "arm64"], var.compute_architecture)
    error_message = "compute_architecture must be amd64 or arm64."
  }
}

variable "data_volume_gib" {
  description = "Requested persistent application-data capacity."
  type        = number
  default     = 30

  validation {
    condition     = var.data_volume_gib >= 10
    error_message = "data_volume_gib must be at least 10 GiB."
  }
}

variable "application_port" {
  description = "RoadmapMentor application port behind the edge proxy."
  type        = number
  default     = 5000
}

variable "common_tags" {
  description = "Environment-specific metadata propagated to provider resources later."
  type        = map(string)
  default     = {}
}
