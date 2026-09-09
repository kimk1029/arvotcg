/** Shed optional cache writes under load instead of building an unbounded DB queue. */
export function createBackgroundWriteGate(limit: number): () => (() => void) | null {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid write limit');
  let active = 0;
  return () => {
    if (active >= limit) return null;
    active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active -= 1;
    };
  };
}
