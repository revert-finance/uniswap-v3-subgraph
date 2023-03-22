/* eslint-disable prefer-const */
import { PoolCreated } from '../types/Factory/Factory'
import { Pool } from '../types/schema'
import { Pool as PoolTemplate } from '../types/templates'
import { BigInt } from '@graphprotocol/graph-ts'

export function handlePoolCreated(event: PoolCreated): void {

  let pool = new Pool(event.params.pool.toHexString()) as Pool
  pool.feeTier = BigInt.fromI32(event.params.fee)
  pool.save()
  // create the tracked contract based on the template
  PoolTemplate.create(event.params.pool)
}
