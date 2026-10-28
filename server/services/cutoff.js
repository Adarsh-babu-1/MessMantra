// Cutoff engine: the SERVER clock decides. The browser clock is only used to draw the countdown.
export function mealState(meal, now = Date.now()) {
  if (now < meal.cutoff_at) return 'open'; // students can opt in or cancel
  if (now < meal.serve_start) return 'locked'; // kitchen is cooking, no changes
  if (now <= meal.serve_end) return 'serving'; // QR scanning allowed
  return 'ended';
}
