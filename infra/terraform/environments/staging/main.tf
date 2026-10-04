module "roadmapmentor" {
  source = "../../modules/application_stack"

  project_name = "RoadmapMentor"
  environment  = "staging"

  deployment_target = {
    provider_name = var.provider_name
    region        = var.deployment_region
    account_id    = var.account_id
  }

  hostname = var.hostname

  network = {
    cidr_block = var.network_cidr
    ingress_rules = [
      {
        name        = "http"
        protocol    = "tcp"
        from_port   = 80
        to_port     = 80
        cidr_blocks = var.allowed_http_cidrs
        purpose     = "HTTP edge traffic and certificate redirects"
      },
      {
        name        = "https"
        protocol    = "tcp"
        from_port   = 443
        to_port     = 443
        cidr_blocks = var.allowed_http_cidrs
        purpose     = "HTTPS application traffic"
      }
    ]
    egress_rules = [
      {
        name        = "outbound"
        protocol    = "all"
        from_port   = -1
        to_port     = -1
        cidr_blocks = ["0.0.0.0/0"]
        purpose     = "Package, registry, API and update access"
      }
    ]
  }

  compute = {
    vcpu             = var.compute_vcpu
    memory_mib       = var.compute_memory_mib
    architecture     = var.compute_architecture
    os_family        = "ubuntu-24.04"
    application_port = var.application_port
    public_access    = true
  }

  storage = {
    mount_path       = "/srv/roadmapmentor-data"
    size_gib         = var.data_volume_gib
    encrypted        = true
    backup_enabled   = true
    lifecycle_policy = "retain"
  }

  bootstrap = {
    runtime_directory    = "/opt/roadmapmentor"
    compose_project_name = "roadmapmentor"
    container_runtime    = "docker"
  }

  tags = var.common_tags
}
