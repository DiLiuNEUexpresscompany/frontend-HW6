# HW7 Report: Uniswap V2 Natural Language Interface

## Project Links
[Github-HW7](https://github.com/DiLiuNEUexpresscompany/frontend-HW6)

[Deployed-Link](https://frontend-hw-6-nextjs.vercel.app/)






## Project Overview
This project implements a natural language interface for Uniswap V2, allowing users to interact with the protocol using plain English commands. The interface supports three main functionalities:
1. Token Swaps
2. Liquidity Provision
3. Pool Information Queries

## Technical Architecture

### Frontend Components
- **NLProcessor.tsx**: The main component that handles natural language processing and command execution
- **PoolQueryExecutor.tsx**: Handles pool-related queries (reserves, swap counts, price distribution)
- **TransactionExecutor.tsx**: Manages token swaps and liquidity provision transactions
- **SwapPriceDistribution.tsx**: Visualizes price distribution data
- **NLInput.tsx**: Provides the user input interface

### LLM Integration
The project integrates Large Language Models (LLM) in the following ways:

1. **Command Parsing**
   - Uses OpenAI's GPT-4 to parse natural language commands
   - Converts user input into structured data for blockchain transactions
   - Example: "swap 10 USDC for ETH" → structured swap parameters

2. **LLM Service Implementation**
   - **OpenAIService**: Handles OpenAI API integration
   - **OpenSourceLLMService**: Alternative implementation for open-source models
   - Both services implement the `LLMService` interface for consistent behavior

3. **Command Types Supported**
   ```typescript
   type CommandType = "swap" | "deposit" | "query" | "error";
   ```

4. **Response Structure**
   ```typescript
   interface LLMResponse {
     type: CommandType;
     action: string;
     params: {
       amount?: number;
       fromToken?: string;
       toToken?: string;
       poolAddress?: string;
       intent?: "getReserves" | "swapCount" | "priceDistribution";
       // ... other parameters
     };
     confidence: number;
     explanation?: string;
   }
   ```

## Key Features

### 1. Natural Language Processing
- Converts user commands into executable blockchain transactions
- Provides confidence scores for parsed commands
- Includes error handling and user feedback

### 2. Pool Information Queries
- Real-time reserve information with proper token decimal formatting
- Swap count tracking
- Price distribution visualization
- Historical data analysis

### 3. Transaction Execution
- Automated token swaps based on parsed commands
- Liquidity provision with proper parameter handling
- Transaction status tracking and feedback

### 4. User Interface
- Clean, intuitive design
- Real-time feedback on command processing
- Visual representation of pool data
- Error handling and user guidance

## Technical Implementation Details

### Environment Configuration
```env
NEXT_PUBLIC_OPENAI_API_KEY=
NEXT_PUBLIC_DEFAULT_LLM_MODEL=gpt-4
NEXT_PUBLIC_OPEN_SOURCE_ENDPOINT=
```

### Security Considerations
- API keys stored in environment variables
- Client-side implementation with appropriate warnings
- Error handling for API failures

### Data Processing
1. User input received through NLInput component
2. Command processed by LLM service
3. Structured response used to:
   - Execute transactions
   - Query pool information
   - Update UI components

## Usage Examples

### Swap Command
```plaintext
"swap 10 USDC for ETH"
```
- Parsed into swap parameters
- Executed through TransactionExecutor
- Real-time status updates

### Query Command
```plaintext
"what are the reserves of the USDC-ETH pool"
```
- Fetches current pool reserves
- Displays formatted token amounts
- Shows last update timestamp

### Liquidity Command
```plaintext
"deposit 5 USDC and 0.1 ETH"
```
- Calculates required token amounts
- Executes liquidity provision
- Updates pool information

## Future Improvements
1. Backend proxy for OpenAI API calls
2. Enhanced error handling and recovery
3. Additional query types and visualizations
4. Support for more complex commands
5. Integration with other DeFi protocols

