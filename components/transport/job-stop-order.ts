type SequencedStop = { sequence: number }

/** New stop is the next destination. Earlier stops keep their order. */
export function appendJobStop<T extends SequencedStop>(stops: T[], blank: T): T[] {
  return [...stops, blank].map((stop, index) => ({ ...stop, sequence: index + 1 }))
}
