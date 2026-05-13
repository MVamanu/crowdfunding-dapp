const DAY_MS = 86_400_000;

export function getDaysLeft(deadline) {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : Number(deadline);
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / DAY_MS));
}

export function isPastDeadline(deadline) {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : Number(deadline);
  return deadlineMs < Date.now();
}
