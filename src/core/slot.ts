/** One place in the program: a pictogram plus the text written above and below it. */
import type { Pictogram } from "./catalog";

export interface Slot {
  pictogram: Pictogram;
  above: string;
  below: string;
  spacing: number; // mm added to the gap on its right (not the last shape of a row)
  breakAfter: boolean; // forced line break: the next shape starts a new row
}

export const newSlot = (pictogram: Pictogram): Slot =>
  ({ pictogram, above: "", below: "", spacing: 0, breakAfter: false });

export const copySlot = (slot: Slot): Slot => ({ ...slot });
