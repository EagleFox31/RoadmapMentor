locals {
  persistent_mounts = {
    for mount in var.persistent_mounts :
    mount.name => mount.mount_path
  }
}
