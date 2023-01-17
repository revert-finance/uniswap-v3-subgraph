/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { bigDecimalExponated, safeDiv } from '.'
import { Tick } from '../types/schema'
import { Mint as MintEvent } from '../types/templates/Pool/Pool'
import { ONE_BD, ZERO_BD, ZERO_BI } from './constants'

export function feeTierToTickSpacing(feeTier: BigInt): BigInt {
  if (feeTier.equals(BigInt.fromI32(10000))) {
    return BigInt.fromI32(200)
  }
  if (feeTier.equals(BigInt.fromI32(3000))) {
    return BigInt.fromI32(60)
  }
  if (feeTier.equals(BigInt.fromI32(500))) {
    return BigInt.fromI32(10)
  }
  if (feeTier.equals(BigInt.fromI32(100))) {
    return BigInt.fromI32(1)
  }

  throw Error('Unexpected fee tier')
}
