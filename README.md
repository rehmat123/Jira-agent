# JIRA AI Agent with LangChain

A sophisticated AI-powered JIRA management system that leverages OpenAI's language models and LangChain framework to automate and streamline JIRA ticket management. This full-stack application provides an intelligent interface for creating, updating, and tracking JIRA tickets through natural language commands.

![JIRA AI Agent Interface](image-1.png)

## 🚀 Features

### Core Functionality
- **Intelligent Ticket Management**
  - Automated ticket creation with AI-powered context understanding
  - Smart ticket updates and status transitions
  - Priority and story point estimation using AI
  - Automated sprint and board assignment

- **Time Management**
  - Precise time tracking with detailed logging
  - Daily time log summaries and analytics
  - Sprint-based time tracking
  - Customizable time logging with comments

- **Sprint Management**
  - Real-time sprint ticket overview
  - Personalized sprint dashboard
  - Team and individual sprint progress tracking
  - Automated sprint assignment

### Advanced Capabilities
- **AI-Powered Intelligence**
  - Natural language processing for ticket management
  - Context-aware responses and suggestions
  - Smart summarization of ticket details
  - Automated priority and complexity assessment

- **User Experience**
  - Thread-based conversation management
  - Persistent chat history
  - Multi-user support with isolated contexts
  - Real-time updates and notifications

## 🛠️ Technical Stack

- **Frontend**
  - React with TypeScript
  - Tailwind CSS for styling
  - Modern UI/UX design principles

- **Backend**
  - Node.js with Express
  - LangChain framework integration
  - OpenAI API integration
  - JIRA REST API integration

- **Development Tools**
  - TypeScript for type safety
  - pnpm for package management
  - ESLint and Prettier for code quality
  - Jest for testing

## 📋 Prerequisites

- Node.js (v16 or higher)
- pnpm package manager
- JIRA account with API access
- OpenAI API key

## 🚀 Getting Started

1. **Clone the Repository**
   ```bash
   git clone https://github.com/rehmat123/Jira-agent.git
   cd Jira-agent
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Update the following variables:
   - `JIRA_URL`
   - `JIRA_USERNAME`
   - `JIRA_API_TOKEN`
   - `JIRA_ASSIGNEE_ACCOUNT_ID`
   - `OPENAI_API_KEY`

4. **Start the Application**
   ```bash
   pnpm start
   ```
   The frontend will be available at `http://localhost:3001`
   The backend will run on `http://localhost:5001`

## 💡 Example Commands

### Ticket Management
```bash
Create a new ticket for project ABC with title "Implement User Authentication"
Update ticket ABC-123 status to "In Progress"
```

### Time Tracking
```bash
Log 2 hours to ticket ABC-123 with comment "Implemented new feature"
Show me how much time I've logged today
```

### Sprint Management
```bash
Show me all tickets in the current sprint for project ABC
Show me my tickets in the current sprint for project ABC
```

## 📁 Project Structure

```
jira-agent/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── App.tsx            # Main application component
│   └── ...
├── backend/               # Backend Node.js application
│   ├── src/
│   │   ├── tools/        # JIRA integration tools
│   │   ├── schemas/      # Data validation schemas
│   │   └── server.ts     # Express server
│   └── ...
└── ...
```

## 🔧 Development Scripts

- `pnpm start`: Start development servers
- `pnpm build`: Build for production
- `pnpm test`: Run test suite
- `pnpm lint`: Run linter
- `pnpm format`: Format code

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for their powerful language models
- LangChain team for their excellent framework
- Atlassian for the JIRA API
- All contributors and users of this project