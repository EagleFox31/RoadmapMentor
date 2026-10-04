export const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export function canAccessObjectPolicy({
  userId,
  aclPolicy,
  requestedPermission,
}: {
  userId?: string;
  aclPolicy: ObjectAclPolicy | null;
  requestedPermission: ObjectPermission;
}): boolean {
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  return aclPolicy.owner === userId;
}
