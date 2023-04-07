/* eslint-disable prefer-const */
import { Pool as PoolABI } from '../types/Factory/Pool'
import {
  Burn as BurnEvent,
  Flash as FlashEvent,
  Collect as CollectEvent,
  Initialize,
  Mint as MintEvent,
  Swap as SwapEvent
} from '../types/templates/Pool/Pool'
import { shouldCacheCalls } from './indexing_util'

export function handleInitialize(event: Initialize): void {}

export function handleMint(event: MintEvent): void {}

export function handleBurn(event: BurnEvent): void {}

export function handleSwap(event: SwapEvent): void {
  if (!shouldCacheCalls(event.block.number)) {
    return
  }
  // update fee growth
  let poolContract = PoolABI.bind(event.address)
  poolContract.feeGrowthGlobal0X128()
  poolContract.feeGrowthGlobal1X128()
}

export function handleCollect(event: CollectEvent): void {}

export function handleFlash(event: FlashEvent): void {
  if (!shouldCacheCalls(event.block.number)) {
    return
  }
  // update fee growth
  let poolContract = PoolABI.bind(event.address)
  poolContract.feeGrowthGlobal0X128()
  poolContract.feeGrowthGlobal1X128()
}
