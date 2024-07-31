/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
  Transfer
} from '../types/NonfungiblePositionManager/NonfungiblePositionManager'
import { Bundle, Pool, Position, PositionSnapshot, Token } from '../types/schema'
import { ADDRESS_ZERO, factoryContract, ZERO_BD, ZERO_BI } from '../utils/constants'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadTransaction } from '../utils'
import { getNativePriceInETH } from '../utils/pricing'

function validate(position: Position | null): boolean {
  if (!position) {
    return false
  }
  let pool = Pool.load(position.pool)
  if (!pool) {
    return false
  }
  if (Address.fromString(position.pool).equals(Address.fromHexString('0x282b7d6bef6c78927f394330dca297eca2bd18cd'))
    || Address.fromString(position.pool).equals(Address.fromHexString('0x5738de8d0b864d5ef5d65b9e05b421b71f2c2eb4'))
    || Address.fromString(position.pool).equals(Address.fromHexString('0x5500721e5a063f0396c5e025a640e8491eb89aac'))
    || Address.fromString(position.pool).equals(Address.fromHexString('0x1ffd370f9d01f75de2cc701956886acec9749e80'))
    || Address.fromString(position.pool).equals(Address.fromHexString('0x000000000000be0ab658f92dddac29d6df19a3be'))
    || Address.fromString(position.pool).equals(Address.fromHexString('0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248'))
    || Address.fromString(position.pool).equals(Address.fromHexString('0x476c6cdf24c269a61d544feb4d3bfdf4afe2cae7'))) {
      return false
  }
  return true
}

function getPosition(event: ethereum.Event, tokenId: BigInt): Position | null {
  let position = Position.load(tokenId.toString())
  if (position === null) {
    let contract = NonfungiblePositionManager.bind(event.address)
    let positionCall = contract.try_positions(tokenId)


    if (!positionCall.reverted) {
      let positionResult = positionCall.value
      let poolAddress = factoryContract.getPool(positionResult.value2, positionResult.value3, positionResult.value4)

      position = new Position(tokenId.toString())
      // The owner gets correctly updated in the Transfer handler
      position.owner = Address.fromString(ADDRESS_ZERO)
      position.pool = poolAddress.toHexString()
      position.token0 = positionResult.value2.toHexString()
      position.token1 = positionResult.value3.toHexString()
      position.tickLower = BigInt.fromI32(positionResult.value5)
      position.tickUpper = BigInt.fromI32(positionResult.value6)
      position.liquidity = ZERO_BI
      position.depositedToken0 = ZERO_BD
      position.depositedToken1 = ZERO_BD
      position.withdrawnToken0 = ZERO_BD
      position.withdrawnToken1 = ZERO_BD
      position.collectedToken0 = ZERO_BD
      position.collectedToken1 = ZERO_BD
      position.collectedFeesToken0 = ZERO_BD
      position.collectedFeesToken1 = ZERO_BD
      position.transaction = loadTransaction(event).id
      position.feeGrowthInside0LastX128 = positionResult.value8
      position.feeGrowthInside1LastX128 = positionResult.value9

      position.amountDepositedUSD = ZERO_BD
      position.amountWithdrawnUSD = ZERO_BD
      position.amountCollectedUSD = ZERO_BD
    }
  }

  return position
}

function updateFeeVars(position: Position, event: ethereum.Event, tokenId: BigInt): Position {
  let positionManagerContract = NonfungiblePositionManager.bind(event.address)
  let positionResult = positionManagerContract.try_positions(tokenId)
  if (!positionResult.reverted) {
    position.feeGrowthInside0LastX128 = positionResult.value.value8
    position.feeGrowthInside1LastX128 = positionResult.value.value9
  }
  return position
}

function savePositionSnapshot(position: Position, event: ethereum.Event, bundle: Bundle, token0: Token, token1: Token): void {
  let positionSnapshot = new PositionSnapshot(position.id.concat('#').concat(event.block.number.toString()))
  positionSnapshot.owner = position.owner
  positionSnapshot.pool = position.pool
  positionSnapshot.position = position.id
  positionSnapshot.blockNumber = event.block.number
  positionSnapshot.timestamp = event.block.timestamp
  positionSnapshot.liquidity = position.liquidity
  positionSnapshot.depositedToken0 = position.depositedToken0
  positionSnapshot.depositedToken1 = position.depositedToken1
  positionSnapshot.withdrawnToken0 = position.withdrawnToken0
  positionSnapshot.withdrawnToken1 = position.withdrawnToken1
  positionSnapshot.collectedFeesToken0 = position.collectedFeesToken0
  positionSnapshot.collectedFeesToken1 = position.collectedFeesToken1
  positionSnapshot.transaction = loadTransaction(event).id
  positionSnapshot.feeGrowthInside0LastX128 = position.feeGrowthInside0LastX128
  positionSnapshot.feeGrowthInside1LastX128 = position.feeGrowthInside1LastX128
  positionSnapshot.ethPriceUSD = bundle.ethPriceUSD
  positionSnapshot.derivedETHToken0 = token0.derivedETH
  positionSnapshot.derivedETHToken1 = token1.derivedETH
  positionSnapshot.derivedETHNative = getNativePriceInETH()
  positionSnapshot.save()
}

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  let position = getPosition(event, event.params.tokenId)

  // position was not able to be fetched
  if (position == null) {
    return
  }

  // temp fix
  if (!validate(position)) { return }
  let bundle = Bundle.load('1')!

  let token0 = Token.load(position.token0)!
  let token1 = Token.load(position.token1)!

  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  position.liquidity = position.liquidity.plus(event.params.liquidity)
  position.depositedToken0 = position.depositedToken0.plus(amount0)
  position.depositedToken1 = position.depositedToken1.plus(amount1)

  let newDepositUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)))
  position.amountDepositedUSD = position.amountDepositedUSD.plus(newDepositUSD)

  position = updateFeeVars(position, event, event.params.tokenId)
  position.save()
  savePositionSnapshot(position, event, bundle, token0, token1)
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  let position = getPosition(event, event.params.tokenId)

  if (!position || !validate(position)) { return }


  let bundle = Bundle.load('1')!
  let token0 = Token.load(position.token0)!
  let token1 = Token.load(position.token1)!
  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  position.liquidity = position.liquidity.minus(event.params.liquidity)
  position.withdrawnToken0 = position.withdrawnToken0.plus(amount0)
  position.withdrawnToken1 = position.withdrawnToken1.plus(amount1)

  let newWithdrawUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)))
  position.amountWithdrawnUSD = position.amountWithdrawnUSD.plus(newWithdrawUSD)

  position = updateFeeVars(position, event, event.params.tokenId)
  position.save()
  savePositionSnapshot(position, event, bundle, token0, token1)
}

export function handleCollect(event: Collect): void {
  let position = getPosition(event, event.params.tokenId)
 
  if (!position || !validate(position)) { return }


  let bundle = Bundle.load('1')!
  let token0 = Token.load(position.token0)!
  let token1 = Token.load(position.token1)!
  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)
  position.collectedToken0 = position.collectedToken0.plus(amount0)
  position.collectedToken1 = position.collectedToken1.plus(amount1)

  position.collectedFeesToken0 = position.collectedToken0.minus(position.withdrawnToken0)
  position.collectedFeesToken1 = position.collectedToken1.minus(position.withdrawnToken1)

  let newCollectUSD = amount0
    .times(token0.derivedETH.times(bundle.ethPriceUSD))
    .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)))
  position.amountCollectedUSD = position.amountCollectedUSD.plus(newCollectUSD)

  position = updateFeeVars(position, event, event.params.tokenId)
  position.save()
  savePositionSnapshot(position, event, bundle, token0, token1)
}

export function handleTransfer(event: Transfer): void {
  let position = getPosition(event, event.params.tokenId)
  if (!position || !validate(position)) { return }
  position.owner = event.params.to
  position.save()

  let bundle = Bundle.load('1')!
  let token0 = Token.load(position.token0)!
  let token1 = Token.load(position.token1)!
  savePositionSnapshot(position, event, bundle, token0, token1)
}
