import { BigInt } from '@graphprotocol/graph-ts'

export function shouldCacheCalls(blockNumber: BigInt): boolean {
  // The subgraph has already indexed up to this block number, so no need to cache calls
  // for blocks before this.
  return blockNumber.gt(BigInt.fromI32(5215174))
}
