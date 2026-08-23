export interface QueueMutation<T> {
  queue: T[];
  queueIndex: number;
  playbackOrder: number[];
}

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

export function resolveQueueOrder(
  length: number,
  currentIndex: number,
  playbackOrder: number[],
  isShuffle: boolean,
): number[] {
  if (length <= 0) return [];
  if (!isShuffle) return range(length);

  const seen = new Set<number>();
  const next: number[] = [];

  for (const index of playbackOrder) {
    if (
      index >= 0 &&
      index < length &&
      !seen.has(index)
    ) {
      seen.add(index);
      next.push(index);
    }
  }

  if (
    currentIndex >= 0 &&
    currentIndex < length &&
    !seen.has(currentIndex)
  ) {
    seen.add(currentIndex);
    next.unshift(currentIndex);
  }

  for (let index = 0; index < length; index += 1) {
    if (!seen.has(index)) {
      seen.add(index);
      next.push(index);
    }
  }

  return next;
}

export function moveQueueItem<T>(
  queue: T[],
  currentIndex: number,
  fromIndex: number,
  toIndex: number,
): QueueMutation<T> {
  if (
    fromIndex < 0 ||
    fromIndex >= queue.length ||
    toIndex < 0 ||
    toIndex >= queue.length ||
    fromIndex === toIndex
  ) {
    return {
      queue,
      queueIndex: currentIndex,
      playbackOrder: range(queue.length),
    };
  }

  const nextQueue = [...queue];
  const [moved] = nextQueue.splice(fromIndex, 1);
  nextQueue.splice(toIndex, 0, moved);

  let nextCurrentIndex = currentIndex;

  if (currentIndex === fromIndex) {
    nextCurrentIndex = toIndex;
  } else if (
    fromIndex < currentIndex &&
    toIndex >= currentIndex
  ) {
    nextCurrentIndex -= 1;
  } else if (
    fromIndex > currentIndex &&
    toIndex <= currentIndex
  ) {
    nextCurrentIndex += 1;
  }

  return {
    queue: nextQueue,
    queueIndex: nextCurrentIndex,
    playbackOrder: range(nextQueue.length),
  };
}

export function removeQueueItem<T>(
  queue: T[],
  currentIndex: number,
  playbackOrder: number[],
  removeIndex: number,
  isShuffle: boolean,
): QueueMutation<T> {
  if (
    removeIndex < 0 ||
    removeIndex >= queue.length ||
    removeIndex === currentIndex
  ) {
    return {
      queue,
      queueIndex: currentIndex,
      playbackOrder: resolveQueueOrder(
        queue.length,
        currentIndex,
        playbackOrder,
        isShuffle,
      ),
    };
  }

  const nextQueue = queue.filter(
    (_, index) => index !== removeIndex,
  );
  const nextCurrentIndex =
    removeIndex < currentIndex
      ? currentIndex - 1
      : currentIndex;

  const resolvedOrder = resolveQueueOrder(
    queue.length,
    currentIndex,
    playbackOrder,
    isShuffle,
  );
  const nextOrder = resolvedOrder
    .filter((index) => index !== removeIndex)
    .map((index) =>
      index > removeIndex
        ? index - 1
        : index,
    );

  return {
    queue: nextQueue,
    queueIndex: nextCurrentIndex,
    playbackOrder: isShuffle
      ? nextOrder
      : range(nextQueue.length),
  };
}

export function clearUpcomingQueue<T>(
  queue: T[],
  currentIndex: number,
  playbackOrder: number[],
  isShuffle: boolean,
): QueueMutation<T> {
  if (
    queue.length === 0 ||
    currentIndex < 0 ||
    currentIndex >= queue.length
  ) {
    return {
      queue,
      queueIndex: currentIndex,
      playbackOrder: resolveQueueOrder(
        queue.length,
        currentIndex,
        playbackOrder,
        isShuffle,
      ),
    };
  }

  if (!isShuffle) {
    const nextQueue = queue.slice(0, currentIndex + 1);

    return {
      queue: nextQueue,
      queueIndex: currentIndex,
      playbackOrder: range(nextQueue.length),
    };
  }

  const resolvedOrder = resolveQueueOrder(
    queue.length,
    currentIndex,
    playbackOrder,
    true,
  );
  const currentPosition = resolvedOrder.indexOf(currentIndex);

  if (currentPosition < 0) {
    return {
      queue,
      queueIndex: currentIndex,
      playbackOrder: resolvedOrder,
    };
  }

  const keptIndices = resolvedOrder.slice(0, currentPosition + 1);
  const nextQueue = keptIndices
    .map((index) => queue[index])
    .filter((item): item is T => item !== undefined);
  const nextCurrentIndex = Math.max(0, nextQueue.length - 1);

  return {
    queue: nextQueue,
    queueIndex: nextCurrentIndex,
    playbackOrder: range(nextQueue.length),
  };
}
