import type { Command } from "../core/commands";
import type { Card, CardId, ObjectId, Stack, StackObject } from "../core/types";

export type Mode = "edit" | "map" | "play";

/** What UI modules may do. Keeps them free of app-state details. */
export interface Ctx {
  stack(): Stack;
  card(): Card;
  sel(): StackObject | undefined;
  mode(): Mode;
  dispatch(cmd: Command): void;
  batch(cmds: readonly Command[]): void;
  selectCard(id: CardId): void;
  selectObject(id: ObjectId | null): void;
  setMode(m: Mode): void;
  render(): void;
  addImageFile(f: Blob): Promise<void>;
}
