# Seeker 

A local research assistant that performs iterative, deep-dive investigations using search engines, web scraping, and LLMs. Combines breadth-first exploration with depth-first analysis for comprehensive topic coverage.

### Clariciation of Search Intent
![Research Process Diagram](https://res.cloudinary.com/diekemzs9/image/upload/v1742669225/Screenshot_2025-03-22_181603_cl5rgp.png)

### Research Process
![Research Process Diagram](https://res.cloudinary.com/diekemzs9/image/upload/v1742669225/Screenshot_2025-03-22_181656_bfcrwe.png)

### End of Task
![Research Process Diagram](https://res.cloudinary.com/diekemzs9/image/upload/v1742669225/Screenshot_2025-03-22_181734_zdoaku.png)


## Features 

- **Iterative Research** - Self-refining research direction based on initial findings
- **Follow-up Question System** - Clarifies research goals through interactive dialogue
- **Configurable Parameters** - Control research breadth (3-10) and depth (1-5)
- **Multi-format Output** - Generates detailed reports or concise answers
- **LLM Agnostic** - Supports OpenAI, Fireworks.ai, and local LLMs via custom endpoints
- **Concurrent Processing** - Parallelizes research tasks for faster results

## Quick Start 🚀

### Prerequisites
- Node.js v18+
- API keys for:
  - [Firecrawl](https://firecrawl.dev/) (web scraping)
  - [OpenAI](https://openai.com/) or [Fireworks.ai](https://fireworks.ai/)

```bash
# Clone repository
git clone https://github.com/iBz-04/Seeker.git
cd Seeker

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Basic Usage
```bash
npm start

? What would you like to research? Effects of climate change on coffee production
? Research breadth (3-10): 5
? Research depth (1-5): 2
```

## Advanced Configuration ⚙️

### Environment Variables
```ini
# Required
FIRECRAWL_API_KEY="your_firecrawl_key"
OPENAI_API_KEY="your_openai_key"  # OR
FIREWORKS_API_KEY="your_fireworks_key"

# Optional
RESEARCH_CONCURRENCY=5  # Parallel requests
MAX_TOKENS=4096         # LLM context window
```

### Docker Deployment
```bash
docker compose up -d --build
docker exec -it deep-research npm run docker
```

## Research Process Flow 🔄

1. **Initial Query Analysis**
   - Parse user's research question
   - Generate clarifying follow-up questions
   - Collect additional context through interactive Q&A

2. **Search Strategy Development**
   - Generate multiple search queries based on research goals
   - Prioritize queries using relevance scoring
   - Execute parallel web searches using Firecrawl

3. **Content Analysis**
   - Extract key insights from web content
   - Maintain context-aware knowledge graph
   - Identify promising research directions for deep-dive

4. **Recursive Exploration**
   - Repeat search/analysis process at specified depth
   - Prune irrelevant branches
   - Merge findings across iterations

5. **Report Generation**
   - Synthesize findings into structured markdown
   - Include sources and confidence ratings
   - Generate both technical and executive summaries

## Customization Options 🛠️

### Adjust Research Parameters
```typescript
// deep-research.ts
const config = {
  maxConcurrency: 5,      // Parallel requests
  minRelevanceScore: 0.7, // Content filtering threshold
  maxPagesPerQuery: 10,   // Resource limits
  timeout: 30000          // Per-request timeout
};
```

### Supported LLM Providers
```ini
# Local AI
OPENAI_BASE_URL="http://localhost:1234/v1"
OPENAI_MODEL="your-local-model"

# OpenRouter
OPENAI_BASE_URL="https://openrouter.ai/api/v1"
OPENAI_MODEL="anthropic/claude-3-haiku"
```

## Example Output 📄

```markdown
# Research Report: Climate Change Impact on Coffee Production

## Key Findings
- **Yield Reductions**: 50% projected decrease in suitable growing areas by 2050
- **Quality Impacts**: Increased temperatures correlate with flavor profile degradation
- **Economic Costs**: $2.5B annual losses anticipated in major producing regions

## Recommended Actions
1. Develop heat-resistant coffee cultivars
2. Implement agroforestry practices
3. Diversify geographic production areas

## Sources
1. [Journal of Agricultural Science] (https://example.com/source1)
2. [FAO Climate Report] (https://example.com/source2)
```

## Troubleshooting ⚠️

**Common Issues:**
- Rate Limiting: Reduce `RESEARCH_CONCURRENCY` in free tier
- Timeouts: Increase `TIMEOUT` duration for complex queries
- Relevance Filtering: Adjust `MIN_RELEVANCE_SCORE` for sensitive content




