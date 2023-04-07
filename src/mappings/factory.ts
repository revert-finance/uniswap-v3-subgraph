import { PoolCreated } from '../types/Factory/Factory'
import { Pool as PoolTemplate } from '../types/templates'

export function handlePoolCreated(event: PoolCreated): void {
  PoolTemplate.create(event.params.pool)
}
