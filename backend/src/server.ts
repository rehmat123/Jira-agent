// server.ts - Main Express backend file with AI function calling using LangChain for Jira ticket creation
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { systemPrompt } from './templates/system';
import { jiraTicketCreatorTool, jiraTicketUpdateTool } from './tools/jira/tools';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

const messageHistories: Record<string, ChatMessageHistory> = {};


const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
});

if (!process.env.OPENAI_API_KEY) {
    console.error("here Missing OpenAI API key in environment variables.");
    process.exit(1);
}


// Routes
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const { prompt: userInput, threadId } = req.body;

        console.log(messageHistories);
        if (!userInput) {
            return res.status(400).json({ error: "Input is required" });
        }
        if (!threadId) {
            return res.status(400).json({ error: "ThreadId is required" });
        }

        // Create message history for this thread
        if (!messageHistories[threadId]) {
            messageHistories[threadId] = new ChatMessageHistory();
        }


        const toolKit = [jiraTicketCreatorTool, jiraTicketUpdateTool];

        const agent = await createOpenAIFunctionsAgent({
            llm: model,
            tools: toolKit,
            prompt: systemPrompt,
        });

        const agentExecutor = new AgentExecutor({
            agent,
            tools: toolKit,
        });

        // Add memory and thread handling
        const agentWithHistory = new RunnableWithMessageHistory({
            runnable: agentExecutor,
            getMessageHistory: (threadId) => messageHistories[threadId] || new ChatMessageHistory(),
            inputMessagesKey: "input",
            historyMessagesKey: "history",
        });

        // Invoke the agent executor with the user input and thread ID
        const result = await agentWithHistory.invoke(
            { input: userInput },
            { configurable: { sessionId: threadId } }
        );

        res.json({ result: result.output });
    } catch (error) {
        console.error('Error processing chat:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
