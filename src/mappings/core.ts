/* eslint-disable prefer-const */
import { Pool, Tick } from '../types/schema'
import { Pool as PoolABI } from '../types/Factory/Pool'
import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  Burn as BurnEvent,
  Flash as FlashEvent,
  Initialize,
  Mint as MintEvent,
  Swap as SwapEvent
} from '../types/templates/Pool/Pool'
import { ZERO_BI } from '../utils/constants'
import { createTick, feeTierToTickSpacing } from '../utils/tick'

export function handleInitialize(event: Initialize): void {
  // update pool sqrt price and tick
  let pool = Pool.load(event.address.toHexString())
  pool.tick = BigInt.fromI32(event.params.tick)
  pool.save()
}

export function handleMint(event: MintEvent): void {
  let poolAddress = event.address.toHexString()

  // tick entities
  let lowerTickIdx = event.params.tickLower
  let upperTickIdx = event.params.tickUpper

  let lowerTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickLower).toString()
  let upperTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickUpper).toString()

  let lowerTick = Tick.load(lowerTickId)
  let upperTick = Tick.load(upperTickId)

  if (lowerTick === null) {
    lowerTick = createTick(lowerTickId, lowerTickIdx, poolAddress, event)
  }

  if (upperTick === null) {
    upperTick = createTick(upperTickId, upperTickIdx, poolAddress, event)
  }

  let amount = event.params.amount
  lowerTick.liquidityGross = lowerTick.liquidityGross.plus(amount)
  lowerTick.liquidityNet = lowerTick.liquidityNet.plus(amount)
  upperTick.liquidityGross = upperTick.liquidityGross.plus(amount)
  upperTick.liquidityNet = upperTick.liquidityNet.minus(amount)

  // Update inner tick vars and save the ticks
  updateTickFeeVarsAndSave(lowerTick!, event)
  updateTickFeeVarsAndSave(upperTick!, event)
}

export function handleBurn(event: BurnEvent): void {
  let poolAddress = event.address.toHexString()

  // tick entities
  let lowerTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickLower).toString()
  let upperTickId = poolAddress + '#' + BigInt.fromI32(event.params.tickUpper).toString()
  let lowerTick = Tick.load(lowerTickId)
  let upperTick = Tick.load(upperTickId)
  let amount = event.params.amount
  lowerTick.liquidityGross = lowerTick.liquidityGross.minus(amount)
  lowerTick.liquidityNet = lowerTick.liquidityNet.minus(amount)
  upperTick.liquidityGross = upperTick.liquidityGross.minus(amount)
  upperTick.liquidityNet = upperTick.liquidityNet.plus(amount)

  updateTickFeeVarsAndSave(lowerTick!, event)
  updateTickFeeVarsAndSave(upperTick!, event)
}

export function handleSwap(event: SwapEvent): void {
  let poolAddress = event.address.toHexString()
  let pool = Pool.load(poolAddress)

  let oldTick = pool.tick!

  pool.tick = BigInt.fromI32(event.params.tick as i32)
  pool.save();

  // Update inner vars of current or crossed ticks
  let newTick = pool.tick!
  let tickSpacing = feeTierToTickSpacing(pool.feeTier)
  let modulo = newTick.mod(tickSpacing)
  if (modulo.equals(ZERO_BI)) {
    // Current tick is initialized and needs to be updated
    loadTickUpdateFeeVarsAndSave(newTick.toI32(), event)
  }

  let numIters = oldTick
    .minus(newTick)
    .abs()
    .div(tickSpacing)

  if (numIters.gt(BigInt.fromI32(100))) {
    // In case more than 100 ticks need to be updated ignore the update in
    // order to avoid timeouts. From testing this behavior occurs only upon
    // pool initialization. This should not be a big issue as the ticks get
    // updated later. For early users this error also disappears when calling
    // collect
  } else if (newTick.gt(oldTick)) {
    let firstInitialized = oldTick.plus(tickSpacing.minus(modulo))
    for (let i = firstInitialized; i.le(newTick); i = i.plus(tickSpacing)) {
      loadTickUpdateFeeVarsAndSave(i.toI32(), event)
    }
  } else if (newTick.lt(oldTick)) {
    let firstInitialized = oldTick.minus(modulo)
    for (let i = firstInitialized; i.ge(newTick); i = i.minus(tickSpacing)) {
      loadTickUpdateFeeVarsAndSave(i.toI32(), event)
    }
  }
}

export function handleFlash(event: FlashEvent): void {

}

function updateTickFeeVarsAndSave(tick: Tick, event: ethereum.Event): void {
  let poolAddress = event.address
  // not all ticks are initialized so obtaining null is expected behavior
  let poolContract = PoolABI.bind(poolAddress)
  let tickResult = poolContract.ticks(tick.tickIdx.toI32())
  tick.feeGrowthOutside0X128 = tickResult.value2
  tick.feeGrowthOutside1X128 = tickResult.value3
  tick.save()
}

function loadTickUpdateFeeVarsAndSave(tickId: i32, event: ethereum.Event): void {
  let poolAddress = event.address
  let tick = Tick.load(
    poolAddress
      .toHexString()
      .concat('#')
      .concat(tickId.toString())
  )
  if (tick !== null) {
    updateTickFeeVarsAndSave(tick!, event)
  }
}
