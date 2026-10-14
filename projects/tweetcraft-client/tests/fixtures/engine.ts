// Tiny authored WASM engine fixture: memory plus the three exports the adapter recognizes.
// No Tweetcraft assets or engine binary are bundled in this project.
export function engineBytes(): Uint8Array<ArrayBuffer> {
  const string = (s: string) => [s.length, ...new TextEncoder().encode(s)];
  const section = (id: number, bytes: number[]) => [id, bytes.length, ...bytes];
  return new Uint8Array([
    0,97,115,109,1,0,0,0,
    ...section(1, [2,0x60,0,1,0x7f,0x60,3,0x7f,0x7f,0x7f,1,0x7f]),
    ...section(3, [3,0,0,1]),
    ...section(5, [1,0,1]),
    ...section(7, [4,...string('memory'),2,0,...string('state_ptr'),0,0,...string('kind_ptr'),0,1,...string('get_block'),0,2]),
    ...section(10, [3,4,0,0x41,0,0x0b,5,0,0x41,0x80,2,0x0b,4,0,0x41,0,0x0b]),
  ]);
}
