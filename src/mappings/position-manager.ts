/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
  Transfer
} from '../types/NonfungiblePositionManager/NonfungiblePositionManager'
import { Position } from '../types/schema'
import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import { shouldCacheCalls } from './indexing_util'

function getPosition(event: ethereum.Event, tokenId: BigInt): void {
  let position = Position.load(tokenId.toString())
  if (position === null) {
    let contract = NonfungiblePositionManager.bind(event.address)
    contract.try_positions(tokenId)
  }
}

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  if (!shouldCacheCalls(event.block.number)) {
    return
  }

  getPosition(event, event.params.tokenId)
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  if (!shouldCacheCalls(event.block.number)) {
    return
  }

  getPosition(event, event.params.tokenId)
}

export function handleCollect(event: Collect): void {
  if (!shouldCacheCalls(event.block.number)) {
    return
  }

  getPosition(event, event.params.tokenId)
}

export function handleTransfer(event: Transfer): void {
  if (!shouldCacheCalls(event.block.number)) {
    return
  }

  getPosition(event, event.params.tokenId)
}
