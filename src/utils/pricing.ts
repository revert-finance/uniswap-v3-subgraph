/* eslint-disable prefer-const */
import { ONE_BD, ZERO_BD, ZERO_BI } from './constants'
import { Bundle, Pool, Token } from './../types/schema'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { exponentToBigDecimal, safeDiv } from '../utils/index'

const WEVMOS_ADDRESS = '0xd4949664cd82660aae99bedc034a0dea8a0bd517'
const WETH_ADDRESS = '0x50de24b3f0b3136c50fa8a3b8ebc8bd80a269ce5' // axlWETH

const stEVMOS_ETH_03_POOL = '0x0086e87fdbfdbff4bbafdf6f577b5aaf15d0228e' //stEVMOS/axlWETH
const stEVMOS_USDC_03_POOL = '0xd02269b612f3bd17cdb3c7dda75ec07aeab868ed' //axlUSDC/stEVMOS

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with
export let WHITELIST_TOKENS: string[] = [
  WEVMOS_ADDRESS,
  WETH_ADDRESS,
  "0x2c68d1d6ab986ff4640b51e1f14c716a076e44c4", // stEVMOS
  "0xc5e00d3b04563950941f7137b5afa3a534f0d6d6", // ATOM
  "0xe46910336479f254723710d57e7b683f3315b22b", // USDC (celer)
  "0x15c3eb3b621d1bff62cba1c9536b7c1ae9149b57", // USDC (axelar)
  // TODO what to add?
]

let MINIMUM_ETH_LOCKED = BigDecimal.fromString('0.001')

let Q192 = 2 ** 192
export function sqrtPriceX96ToTokenPrices(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal[] {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal()
  let denom = BigDecimal.fromString(Q192.toString())
  let price1 = num
    .div(denom)
    .times(exponentToBigDecimal(token0.decimals))
    .div(exponentToBigDecimal(token1.decimals))

  let price0 = safeDiv(BigDecimal.fromString('1'), price1)
  return [price0, price1]
}

export function getEthPriceInUSD(): BigDecimal {
  // use two pools to estimate usd eth price
  let pool0 = Pool.load(stEVMOS_ETH_03_POOL)
  let pool1 = Pool.load(stEVMOS_USDC_03_POOL)

  if (pool0 !== null && pool1 != null) {
    return pool0.token0Price.times(pool1.token0Price)
  } else {
    return ZERO_BD
  }
}

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token, otherToken: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD
  }
  let whiteList = token.whitelistPools
  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let largestLiquidityETH = ZERO_BD
  let priceSoFar = ZERO_BD
  for (let i = 0; i < whiteList.length; ++i) {
    let poolAddress = whiteList[i]
    let pool = Pool.load(poolAddress)
    if (pool.liquidity.gt(ZERO_BI)) {
      if (pool.token0 == token.id && (pool.token1 != otherToken.id || !WHITELIST_TOKENS.includes(pool.token0))) {
        // whitelist token is token1
        let token1 = Token.load(pool.token1)
        // get the derived ETH in pool
        let ethLocked = pool.totalValueLockedToken1.times(token1.derivedETH)
        if (ethLocked.gt(largestLiquidityETH) && ethLocked.gt(MINIMUM_ETH_LOCKED)) {
          largestLiquidityETH = ethLocked
          // token1 per our token * Eth per token1
          priceSoFar = pool.token1Price.times(token1.derivedETH as BigDecimal)
        }
      }
      if (pool.token1 == token.id && (pool.token0 != otherToken.id || !WHITELIST_TOKENS.includes(pool.token1))) {
        let token0 = Token.load(pool.token0)
        // get the derived ETH in pool
        let ethLocked = pool.totalValueLockedToken0.times(token0.derivedETH)
        if (ethLocked.gt(largestLiquidityETH) && ethLocked.gt(MINIMUM_ETH_LOCKED)) {
          largestLiquidityETH = ethLocked
          // token0 per our token * ETH per token0
          priceSoFar = pool.token0Price.times(token0.derivedETH as BigDecimal)
        }
      }
    }
  }
  return priceSoFar // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0USD = token0.derivedETH.times(bundle.ethPriceUSD)
  let price1USD = token1.derivedETH.times(bundle.ethPriceUSD)

  // both are whitelist tokens, return sum of both amounts
  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD
}