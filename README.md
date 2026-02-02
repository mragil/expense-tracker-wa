# 📊 WhatsApp Expense Tracker (WA-Expense)

A powerful, privacy-first WhatsApp bot that helps you manage your finances using natural language. Built with Hono, Drizzle ORM, and Google's Gemini AI.

---

## ✨ Key Features

*   **Natural Language Processing**: Log expenses and income by just chatting (e.g., "Spent 50k on lunch today").
*   **Flexible Reporting**:
    *   Summaries for **Today**, **Week**, **Month**, **Year**, **Last Month**, and **All Time**.
    *   Detailed transaction lists including full timestamps (`DD/MM/YY HH:MM`).
*   **Budget Management**: Set and track budgets for Daily, Monthly, or Yearly periods.
*   **Multi-Language Support**: Fully localized in **English** and **Indonesian**.
*   **Privacy-First**:
    *   Data stored locally in **SQLite**.
    *   AI extraction via **Google Gemini** (strictly data extraction, no conversational fluff).
*   **Public Access Toggle**: Allow whitelisted usage or open it for public use via a simple config.
*   **Container Ready**: Production-optimized multi-stage Docker build.

---

## 🛠️ Tech Stack

*   **Framework**: [Hono](https://hono.dev/) (Runtime: Node.js)
*   **Database**: [Drizzle ORM](https://orm.drizzle.team/) with [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
*   **AI Engine**: [Google Gemini AI](https://ai.google.dev/)
*   **WhatsApp Gateway**: [Evolution API v2](https://evolution-api.com/)
*   **Architecture**: Class-based Dependency Injection with Hono Factory pattern.

---

## 🚀 Getting Started

### Prerequisites

*   Node.js v20+
*   pnpm
*   An instance of Evolution API v2
*   Google Gemini AI API Key

### 1. Installation

```bash
git clone https://github.com/mragil/expense-tracker-wa.git
cd expense-tracker-wa
pnpm install
```

### 2. Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Gemini API Key | - |
| `DATABASE_URL` | Path to your SQLite file | `sqlite.db` |
| `EVOLUTION_API_URL` | Your Evolution API instance URL | - |
| `EVOLUTION_API_KEY` | Your Evolution API Global Key | - |
| `OPEN_FOR_PUBLIC` | Set to `true` to skip whitelist checks | `false` |

### 3. Run Locally

```bash
# Push database schema
pnpm run db:push

# Start dev server
pnpm run dev
```

### 4. Run with Docker

```bash
# Build the image
docker build -t expense-tracker-app .

# Run the container
docker run -p 3000:3000 \
  -v ./data:/app/data \
  -e DATABASE_URL=/app/data/sqlite.db \
  -e GOOGLE_GENERATIVE_AI_API_KEY=your_key \
  expense-tracker-app
```

---

## 🏗️ Architecture

The app uses a modern, decoupled architecture:

*   **Service Layer**: Business logic resides in pure classes (`TransactionService`, `ReportService`, etc.).
*   **Containerization**: All services are orchestrated in `container.ts` and connections are injected via request context.
*   **Hono Factory**: Leveraging Hono's `createFactory` for fully typed route handlers and middleware-based DI.

---

## 💬 Usage Examples

*   **Logging (Expenses & Income)**:
    *   🇮🇩 "Beli bakso 20rb" / 🇺🇸 "Bought lunch for $5"
    *   🇮🇩 "Uang masuk 5 juta dari gaji" / 🇺🇸 "Received $3000 salary"
*   **Reports**:
    *   🇮🇩 "Laporan bulan ini" / 🇺🇸 "Monthly report"
    *   🇮🇩 "Show all time report" / 🇺🇸 "All time summary"
    *   🇮🇩 "Laporan Januari 2026" / 🇺🇸 "Report for January 2026"
*   **Budget**:
    *   🇮🇩 "Set budget 5jt per bulan" / 🇺🇸 "Set monthly budget to $1000"
    *   🇮🇩 "Info budget" / 🇺🇸 "Budget status"

---

## 📄 License

This project is licensed under the MIT License.
