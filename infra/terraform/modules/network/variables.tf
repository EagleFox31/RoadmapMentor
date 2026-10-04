variable "name" {
  description = "Provider-neutral name for the network boundary."
  type        = string

  validation {
    condition     = length(trimspace(var.name)) > 0
    error_message = "name must not be empty."
  }
}

variable "cidr_block" {
  description = "IPv4 CIDR allocated to the application network."
  type        = string

  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "cidr_block must be a valid IPv4 CIDR."
  }
}

variable "ingress_rules" {
  description = "Intent-level inbound rules. Provider-specific security resources are added later."
  type = list(object({
    name        = string
    protocol    = string
    from_port   = number
    to_port     = number
    cidr_blocks = list(string)
    purpose     = string
  }))
  default = []

  validation {
    condition = alltrue([
      for rule in var.ingress_rules :
      length(trimspace(rule.name)) > 0 &&
      contains(["tcp", "udp", "icmp"], lower(rule.protocol)) &&
      rule.from_port >= -1 &&
      rule.to_port <= 65535 &&
      rule.from_port <= rule.to_port &&
      length(rule.cidr_blocks) > 0 &&
      alltrue([for cidr in rule.cidr_blocks : can(cidrhost(cidr, 0))])
    ])
    error_message = "Each ingress rule must have a name, supported protocol, valid port range and valid CIDR blocks."
  }
}

variable "tags" {
  description = "Metadata propagated by the eventual provider implementation."
  type        = map(string)
  default     = {}
}
