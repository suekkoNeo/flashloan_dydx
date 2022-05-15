require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

module.exports = {
  networks: {
    hardhat: {},
    mainnet: {
      url: process.env.INFURA_HTTP_MAINNET,
      accounts: [process.env.PRIVATE_KEY_PRD],
    },
    ropsten: {
      url: process.env.INFURA_HTTP_ROPSETEN,
      accounts: [process.env.PRIVATE_KEY_TEST],
    },
    mumbai: {
      url: process.env.HTTP_MUMBAI,
      accounts: [process.env.PRIVATE_KEY_TEST],
    },
    polygon: {
      url: process.env.HTTP_POLYGON,
      accounts: [process.env.PRIVATE_KEY_PRD],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.5.0",
      },
      {
        version: "0.5.7",
      },
      {
        version: "0.8.0",
      },
    ],
  },
};
