const sushiswap = require("./sushiswapjs");
const uniswap = require("./uniswap");
const dydx = require("./dydx");
const tokens = require("./tokens");

module.exports = {
  mainnet: {
    sushiswap: sushiswap.mainnet,
    uniswap: uniswap.mainnet,
    dydx: dydx.mainnet,
    tokens: tokens.mainnet,
  },
  ropsten: {
    sushiswap: sushiswap.ropsten,
    uniswap: uniswap.ropsten,
    dydx: dydx.ropsten,
    tokens: tokens.ropsten,
  },
  polygon: {
    sushiswap: sushiswap.polygon,
    uniswap: uniswap.polygon,
    dydx: dydx.polygon,
    tokens: tokens.polygon,
  },
};
