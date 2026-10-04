locals {
  normalized_ingress_rules = [
    for rule in var.ingress_rules : {
      name        = trimspace(rule.name)
      protocol    = lower(rule.protocol)
      from_port   = rule.from_port
      to_port     = rule.to_port
      cidr_blocks = sort(distinct(rule.cidr_blocks))
      purpose     = trimspace(rule.purpose)
    }
  ]

  normalized_egress_rules = [
    for rule in var.egress_rules : {
      name        = trimspace(rule.name)
      protocol    = lower(rule.protocol)
      from_port   = rule.from_port
      to_port     = rule.to_port
      cidr_blocks = sort(distinct(rule.cidr_blocks))
      purpose     = trimspace(rule.purpose)
    }
  ]
}
