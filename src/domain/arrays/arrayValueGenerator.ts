import type { RandomSource } from "../generators/generator";
import { systemRandom } from "../generators/generator";
import type { JsonValue } from "../manual/storageValue";

export class ArrayValueGenerator {
  public constructor(private readonly random: RandomSource = systemRandom) {}

  public pick(items: readonly JsonValue[]): JsonValue | undefined {
    if (items.length === 0) return undefined;
    const index = Math.min(items.length - 1, Math.floor(this.random.next() * items.length));
    return items[index];
  }
}
