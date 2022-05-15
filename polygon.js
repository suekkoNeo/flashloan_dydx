require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const {
  ChainId: sChainId,
  Token: sToken,
  WETH: sWETH,
  Fetcher: sFetcher,
  Trade: sTrade,
  Route: sRoute,
  TokenAmount: sTokenAmount,
  TradeType: sTradeType,
} = require("@sushiswap/sdk");

// use @uniswap/sdk@3.0.0
const {
  ChainId: uChainId,
  Token: uToken,
  WETH: uWETH,
  Fetcher: uFetcher,
  Trade: uTrade,
  Route: uRoute,
  TokenAmount: uTokenAmount,
  TradeType: uTradeType,
} = require("@uniswap/sdk");

let wss = "";
let private_key = "";
let flashloan_contract_address = "";
let chainId = 0;
let addresses = {};
let {
  mainnet: mainnet_addresses,
  ropsten: ropsten_addresses,
  polygon: polygon_addresses,
} = require("./addresses");

if (process.argv[2] == "mumbai") {
  wss = process.env.WSS_MUMBAI;
  private_key = process.env.PRIVATE_KEY_TEST;
  flashloan_contract_address = process.env.FLASHLOAN_CONTRACT_MUMBAI;
} else if (process.argv[2] == "matic") {
  chainId = 137;
  addresses = polygon_addresses;
  wss = process.env.WSS_MATIC;
  private_key = process.env.PRIVATE_KEY_PRD;
  flashloan_contract_address = process.env.FLASHLOAN_CONTRACT_MUMBAI;
} else if (!process.argv[2]) {
  console.error("\nHey, You should pick network up!!\n");
  process.exit();
} else {
  console.error("\nYou specify wrong network name ?\n");
  process.exit();
}

const web3 = new Web3();
web3.setProvider(new web3.providers.WebsocketProvider(wss));

const { address: admin } = web3.eth.accounts.wallet.add(private_key);

const Flashloan = require("./artifacts/contracts/Flashloan.sol/Flashloan.json");
const ethers = require("ethers");
const matic = {
  name: "matic",
  chainId: 137,
  _defaultProvider: (providers) =>
    new providers.JsonRpcProvider(process.env.HTTP_MATIC),
};

const provider = ethers.getDefaultProvider(matic);

const main = async () => {
  const networkId = await web3.eth.net.getId();
  const flashloan = new web3.eth.Contract(
    Flashloan.abi,
    flashloan_contract_address
  );

  const [uDai, uWmatic, uLink] = await Promise.all(
    [addresses.tokens.dai, addresses.tokens.wmatic, addresses.tokens.link].map(
      (tokenAddress) => uFetcher.fetchTokenData(chainId, tokenAddress, provider)
    )
  );

  const [sDai, sWmatic, sLink] = await Promise.all(
    [addresses.tokens.dai, addresses.tokens.wmatic, addresses.tokens.link].map(
      (tokenAddress) => sFetcher.fetchTokenData(chainId, tokenAddress, provider)
    )
  );

  const tokenPairs = [["WMATIC", "DAI", "LINK"]];
  const tokenFetchers = [[uWmatic, uDai, sDai, sWmatic, sLink, uLink, uWmatic]];
  const amount = process.env.TRADE_AMOUNT;

  web3.eth
    .subscribe("newBlockHeaders", (error, result) => {
      if (!error) {
        // console.log(result);
        return;
      }
      console.error("------connecting error---------");
      console.error(error);
      console.error("------connecting error---------");
    })
    .on("connected", (subscriptionId) => {
      console.log(`You are connected on ${subscriptionId}: ${process.argv[2]}`);
    })
    .on("data", async (block) => {
      console.log(
        "-------------------------------------------------------------"
      );
      console.log(`New block received. Block # ${block.number}`);
      console.log(
        `GasLimit: ${block.gasLimit} and Timestamp: ${block.timestamp}`
      );

      // token pairごとに配列を増やしていく想定なのでforで回す
      for (let i = 0; i < tokenPairs.length; i++) {
        console.log(
          `Investigation path: ${tokenPairs[i][0]} -> ${tokenPairs[i][1]} -> ${tokenPairs[i][2]}`
        );

        const unit0 = await new BigNumber(amount).toString();
        // eth -> wei
        const amount0 = BigInt(
          new BigNumber(unit0)
            .shiftedBy(tokenFetchers[i][0].decimals)
            .toString()
        );

        await uFetcher
          .fetchPairData(tokenFetchers[i][1], tokenFetchers[i][0], provider)
          .then(async (uAtoB) => {
            const route1 = new uRoute([uAtoB], tokenFetchers[i][0]);
            const trade1 = new uTrade(
              route1,
              new uTokenAmount(tokenFetchers[i][0], amount0),
              uTradeType.EXACT_INPUT
            );

            const rate1 = new BigNumber(
              trade1.executionPrice.toSignificant(6)
            ).toString();

            console.log(
              `Putting ${unit0} ${tokenPairs[i][0]} into Uniswap pool`
            );
            console.log(
              `Rate ${tokenPairs[i][0]}/${tokenPairs[i][1]}: ${rate1}`
            );
            console.log(
              `Sell ${tokenPairs[i][0]} for ${tokenPairs[i][1]} at Uniswap: ${
                rate1 * unit0
              }`
            );
          })
          .catch((e) => {
            console.log("\n========error=======\n");
            console.error(e);
            console.log("\n========error=======\n");
            process.exit();
          });

        console.log("ccc");

        // 2. Sell B for C at Sushiswap
        const unit1 = await new BigNumber(rate1).times(unit0).toString();
        const amount1 = await BigInt(
          new BigNumber(rate1)
            .times(unit0)
            .shiftedBy(tokenFetchers[i][2].decimals)
            .toFixed()
        );

        const sBtoWeth = await sFetcher.fetchPairData(
          tokenFetchers[i][3],
          tokenFetchers[i][2],
          provider
        );
        const sWethtoC = await sFetcher.fetchPairData(
          tokenFetchers[i][4],
          tokenFetchers[i][3],
          provider
        );
        const route2 = await new sRoute(
          [sBtoWeth, sWethtoC],
          tokenFetchers[i][2]
        );
        const trade2 = await new sTrade(
          route2,
          new sTokenAmount(tokenFetchers[i][2], amount1),
          sTradeType.EXACT_INPUT
        );
        const rate2 = await new BigNumber(
          trade2.executionPrice.toSignificant(6)
        ).toString();

        console.log(`Putting ${unit1} ${tokenPairs[i][1]} into Sushiswap pool`);
        console.log(
          `Rate ${tokenPairs[i][1]} for ${tokenPairs[i][2]}: ${rate2}`
        );
        console.log(
          `Sell ${tokenPairs[i][1]} for ${tokenPairs[i][2]} at Sushiswap: ${
            rate2 * unit1
          }`
        );

        // 3. Sell C for A at Uniswap
        const unit2 = await new BigNumber(rate2).times(unit1).toString(); // BigNumber
        const amount2 = await BigInt(
          new BigNumber(rate2)
            .times(unit1)
            .shiftedBy(tokenFetchers[i][4].decimals)
            .toFixed()
        );
        const uCtoA = await uFetcher.fetchPairData(
          tokenFetchers[i][6],
          tokenFetchers[i][5],
          provider
        );
        const route3 = await new uRoute([uCtoA], tokenFetchers[i][5]);
        const trade3 = await new uTrade(
          route3,
          new uTokenAmount(tokenFetchers[i][5], amount2),
          uTradeType.EXACT_INPUT
        );
        const rate3 = await new BigNumber(
          trade3.executionPrice.toSignificant(6)
        ).toString();
        console.log(`Putting ${unit2} ${tokenPairs[i][2]} into Uniswap pool`);
        console.log(
          `Rate ${tokenPairs[i][2]} for ${tokenPairs[i][0]}: ${rate3}`
        );
        console.log(
          `Sell ${tokenPairs[i][2]} for ${tokenPairs[i][0]} at Uniswap: ${
            rate3 * unit2
          }`
        );

        const unit4 = await new BigNumber(rate3).times(unit2).toString(); // BigNumber
        let profit = await new BigNumber(unit4).minus(unit0).toString();
        console.log(`Initial supply from a flashloan: ${unit0}`);
        console.log(`Obtained amount after an arbitrage: ${unit4}`);
        console.log(`Profit: ${profit}`);

        if (profit > 0) {
          const tx = flashloan.methods.initiateFlashLoan(
            addresses.dydx.solo,
            addresses.tokens.weth,
            addresses.tokens.dai,
            addresses.tokens.link,
            amount
          );

          const [gasPrice, gasCost] = await Promise.all([
            web3.eth.getGasPrice(),
            tx.estimateGas({ from: admin }),
          ]);

          const txCost =
            web3.utils.toBN(gasCost) * web3.utils.toBN(gasPrice) * 2;
          profit = profit - txCost;

          if (profit > 0) {
            console.log(`
                    Block # ${block.number}: Arbitrage opportunity found!
                    Expected profit: ${profit}
                `);
            const data = tx.encodeABI();
            const txData = {
              from: admin,
              to: flashloan.options.address,
              data,
              gas: gasCost,
              gasPrice,
            };
            const receipt = await web3.eth.sendTransaction(txData);
            console.log(`Transaction hash: ${receipt.transactionHash}`);
          } else {
            console.log(`
                    Block # ${block.number}: Arbitrage opportunity not found.
                    Expected profit: ${profit}
                `);
          }
        }
      }
    })
    .on("error", (error) => {
      console.log(error);
    });
};

main();

// const getDAIPriceInUni = async () => {
//   const DAI = new uToken(
//     uChainId.MAINNET,
//     "0x6B175474E89094C44Da98b954EedeAC495271d0F",
//     18
//   );

//   const pair = await uFetcher.fetchPairData(DAI, uWETH[DAI.chainId]);
//   const route = new uRoute([pair], uWETH[DAI.chainId]);

//   console.log(`uniswap DAI/WETH ${route.midPrice.toSignificant(6)}`); // DAI/WETH
// };

// const getDAIPriceInSushi = async () => {
//   const DAI = new sToken(
//     sChainId.MAINNET,
//     "0x6B175474E89094C44Da98b954EedeAC495271d0F",
//     18
//   );

//   const pair = await sFetcher.fetchPairData(DAI, sWETH[DAI.chainId]);
//   const route = new sRoute([pair], sWETH[DAI.chainId]);

//   console.log(route.midPrice.toSignificant(6)); // DAI/WETH
//   console.log(`sushiswap DAI/WETH ${route.midPrice.toSignificant(6)}`); // DAI/WETH
// };

// getDAIPriceInUni();
// getDAIPriceInSushi();
