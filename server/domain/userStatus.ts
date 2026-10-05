export type UserStatusAction = "disable" | "enable";

export function planUserStatus(
  action: UserStatusAction,
  current: { disabledAt: Date | null } | undefined,
): "not_found" | "noop" | "apply" {
  if (!current) return "not_found";
  const isDisabled = current.disabledAt !== null;
  return (action === "disable") === isDisabled ? "noop" : "apply";
}
