# 🦄 Uniswap V2 Natural Language Interface

<h4 align="center">
  A natural language interface for Uniswap V2, powered by LLM
</h4>

🧪 This project implements a natural language interface for Uniswap V2, allowing users to interact with the protocol using plain English commands. It's built on top of Scaffold-ETH 2 and integrates Large Language Models (LLM) to provide a more intuitive way to interact with DeFi protocols.

⚙️ Built using NextJS, RainbowKit, Foundry, Wagmi, Viem, Typescript, and OpenAI's GPT-4.

## Features

- 💬 **Natural Language Commands**: Interact with Uniswap V2 using plain English
- 🔄 **Token Swaps**: Execute swaps with simple commands like "swap 10 USDC for ETH"
- 💧 **Liquidity Management**: Add/remove liquidity with natural language
- 📊 **Pool Analytics**: Query pool information and visualize data
- 🤖 **LLM Integration**: Powered by OpenAI's GPT-4 for command parsing
- 🎨 **Interactive UI**: Clean and intuitive interface with real-time feedback

## Supported Commands

### Swap Tokens
```plaintext
"swap 10 USDC for ETH"
"exchange 5 DAI to WETH"
```

### Add Liquidity
```plaintext
"deposit 5 USDC and 0.1 ETH"
"add 1000 USDT and 1 WBTC to liquidity"
```

### Query Pool Information
```plaintext
"what are the reserves of the USDC-ETH pool"
"show me the swap count for WBTC-ETH pool today"
"display price distribution for DAI-USDC pool"
```

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)
- OpenAI API Key (for LLM functionality)

## Quickstart

1. Clone the repository and install dependencies:
```bash
git clone [your-repo-url]
cd uniswap-nl-interface
yarn install
```

2. Set up environment variables:
```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
```
Edit `.env.local` and add your OpenAI API key:
```
NEXT_PUBLIC_OPENAI_API_KEY=your-api-key
```

3. Run a local network:
```bash
yarn chain
```

4. Deploy the contracts:
```bash
yarn deploy
```

5. Start the development server:
```bash
yarn start
```

Visit your app at: `http://localhost:3000/nl-interface`

## Project Structure

- `packages/nextjs/components/uniswap/`
  - `NLProcessor.tsx`: Main component for natural language processing
  - `PoolQueryExecutor.tsx`: Handles pool-related queries
  - `TransactionExecutor.tsx`: Manages token swaps and liquidity
  - `SwapPriceDistribution.tsx`: Visualizes price data
  - `NLInput.tsx`: User input interface

## Environment Variables

Required environment variables:
```env
NEXT_PUBLIC_OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_DEFAULT_LLM_MODEL=gpt-4
NEXT_PUBLIC_OPEN_SOURCE_ENDPOINT=optional-open-source-llm-endpoint
```

## Security Considerations

- API keys are stored in environment variables
- Client-side implementation includes appropriate warnings
- Error handling for API failures
- Consider using a backend proxy for production deployment

## Contributing

We welcome contributions to improve the natural language interface! Please feel free to:
- Add support for more complex commands
- Improve error handling
- Add new visualizations
- Enhance the LLM integration

## License

This project is licensed under the MIT License - see the LICENSE file for details.