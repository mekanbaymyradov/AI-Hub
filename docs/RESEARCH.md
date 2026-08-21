# AI Hub Research

Notes and research findings gathered during the initial phases of the AI-Hub project development.

---

## 1. Architectural Access Models

When designing an AI Gateway, there are two primary approaches to API credentials and billing:

### Option A: Gateway-Owned Accounts (Service Provider Model)
* **How it works:** The AI Hub owns and manages the API accounts and credentials for the various AI providers.
* **Billing:** The provider charges your (the Gateway developer's) account based on aggregate developer API usage. You then bill your end-users (e.g., via a markup, subscription, or usage quota).
* **Pros:** Easier user onboarding (users don't need API keys); centralized logging and rate limiting.
* **Cons:** High financial risk (you bear the cost of API usage and must manage billing/abuse detection).

### Option B: Bring Your Own Key / BYOK (Client-Owned Model)
* **How it works:** End-users supply their own API keys for the providers they wish to use.
* **Billing:** The provider bills the end-user directly according to their API usage. The Gateway acts purely as a routing/proxy layer.
* **Pros:** Zero billing risk for the gateway developer; lower overhead.
* **Cons:** Higher barrier to entry for non-technical users; requires secure management of third-party credentials.

---

## 2. Token Usage & Cost Estimation

Every prompt sent through the gateway is processed and billed based on its token lifecycle.

### The Cost Equation
LLM providers charge based on **tokens** (units of text containing ~4 characters or 0.75 words):

$$\text{Total Cost} = (\text{Input Tokens} \times \text{Input Rate}) + (\text{Output Tokens} \times \text{Output Rate})$$

### Context Window & Growth Limits
* **Context Growth**: In a chat session, every new message typically appends the previous conversation history. Consequently, the input token count grows cumulatively with each turn, increasing the cost of subsequent prompts.
* **Context Limits**: Every model has a maximum number of tokens it can remember in one request (the model's context window).

---

## 3. Provider API Access & Tiers

It is common to confuse **Consumer Apps** (like ChatGPT, Gemini on the web, or Claude.ai) with **Developer APIs**. Consumer apps often offer free tiers for web interaction, whereas Developer APIs are billed programmatically.

### Developer API Comparison

| Provider | Free Tier Available? | Paid API? | Notes & Developer Quotas |
| :--- | :---: | :---: | :--- |
| **OpenAI** | ❌ No | ✅ Yes | Requires pre-funding or post-paid billing configuration to access. |
| **Anthropic** | ❌ No | ✅ Yes | Paid usage only; tiers are based on usage history. |
| **Google (Gemini)** | ✅ Yes (Limited) | ✅ Yes | Offers a free tier with rate limits and quota caps, suitable for development. |