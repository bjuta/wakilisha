import {
  describe,
  expect,
  it,
} from "vitest";
import {
  clearUpcomingQueue,
  moveQueueItem,
  removeQueueItem,
  resolveQueueOrder,
} from "@/services/player/queueModel";

const queue = ["a", "b", "c", "d"];

describe("Player queue model", () => {
  it("uses canonical queue order when Shuffle is off", () => {
    expect(
      resolveQueueOrder(4, 1, [1, 3, 0, 2], false),
    ).toEqual([0, 1, 2, 3]);
  });

  it("preserves a valid shuffled playback order", () => {
    expect(
      resolveQueueOrder(4, 1, [1, 3, 0, 2], true),
    ).toEqual([1, 3, 0, 2]);
  });

  it("keeps the current Track authoritative when a shuffled order is stale", () => {
    expect(
      resolveQueueOrder(4, 2, [1, 3], true),
    ).toEqual([2, 1, 3, 0]);
  });

  it("reorders queued items without losing the current Track", () => {
    const result = moveQueueItem(queue, 1, 3, 2);

    expect(result.queue).toEqual(["a", "b", "d", "c"]);
    expect(result.queueIndex).toBe(1);
    expect(result.playbackOrder).toEqual([0, 1, 2, 3]);
  });

  it("updates the current index when an earlier item is removed", () => {
    const result = removeQueueItem(
      queue,
      2,
      [0, 1, 2, 3],
      0,
      false,
    );

    expect(result.queue).toEqual(["b", "c", "d"]);
    expect(result.queueIndex).toBe(1);
    expect(result.playbackOrder).toEqual([0, 1, 2]);
  });

  it("will not remove the Track that is playing", () => {
    const result = removeQueueItem(
      queue,
      2,
      [0, 1, 2, 3],
      2,
      false,
    );

    expect(result.queue).toBe(queue);
    expect(result.queueIndex).toBe(2);
  });

  it("clears normal Up Next without changing play history", () => {
    const result = clearUpcomingQueue(
      queue,
      1,
      [0, 1, 2, 3],
      false,
    );

    expect(result.queue).toEqual(["a", "b"]);
    expect(result.queueIndex).toBe(1);
    expect(result.playbackOrder).toEqual([0, 1]);
  });

  it("clears shuffled Up Next while preserving played order and the current Track", () => {
    const result = clearUpcomingQueue(
      queue,
      3,
      [1, 0, 3, 2],
      true,
    );

    expect(result.queue).toEqual(["b", "a", "d"]);
    expect(result.queueIndex).toBe(2);
    expect(result.playbackOrder).toEqual([0, 1, 2]);
  });
});
