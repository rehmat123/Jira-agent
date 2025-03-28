// server.ts - Express backend with LangChain implementation
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { JiraTicketCreator, TicketDetails } from './jiraTicketCreator';
import { ChatOpenAI } from "@langchain/openai";

import { 
  BufferMemory,
  ConversationTokenBufferMemory
} from "langchain/memory";
import { 
  DynamicStructuredTool 
} from "@langchain/core/tools";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder
} from "@langchain/core/prompts";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { z } from "zod";
import { LLMChain } from "langchain/chains";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Jira Ticket Creator
const jiraTicketCreator = new JiraTicketCreator(
  process.env.JIRA_URL!,
  process.env.JIRA_USERNAME!,
  process.env.JIRA_API_TOKEN!,
  process.env.JIRA_ASSIGNEE_ACCOUNT_ID!,
  process.env.OPENAI_API_KEY!
);

// Initialize the LangChain chat model
const chatModel = new ChatOpenAI({
  temperature: 0.7,
  modelName: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPENAI_API_KEY!
});

// Define the create JIRA ticket tool with LangChain's structured tool
const createJiraTicketTool = new DynamicStructuredTool({
  name: "createJiraTicket",
  description: "Create JIRA Ticket based on user input",
  schema: z.object({
    title: z.string().describe("The title or summary of the JIRA ticket"),
    description: z.string().describe("Detailed description of the ticket"),
    project: z.string().describe("JIRA project key (e.g., 'PROJ')"),
    issueType: z.string().describe("Type of issue (e.g., 'Story', 'Bug', 'Task')"),
    priority: z.string().describe("Priority level (e.g., 'High', 'Medium', 'Low')"),
    storyPoints: z.number().optional().describe("Estimated story points (1, 2, 3, 5, 8, 13)"),
    parentKey: z.string().optional().describe("Optional parent ticket key"),
  }),
  func: async (args) => {
    try {
      const ticketDetails: TicketDetails = {
        summary: args.title,
        description: args.description,
        project: args.project,
        issueType: args.issueType,
        priority: args.priority,
        storyPoints: args.storyPoints,
        parentKey: args.parentKey
      };
      
      const result = await jiraTicketCreator.createJiraTicket(ticketDetails);
      
      if (result) {
        return `Successfully created JIRA ticket: https://westwing.jira.com/browse/${result}`;
      } else {
        return "Failed to create JIRA ticket. Please check the details and try again.";
      }
    } catch (error) {
      console.error('Error creating JIRA ticket:', error);
      return `Error creating JIRA ticket: ${error}`;
    }
  }
});

// Use Buffer Memory instead of Summary Memory for simplicity
const memory = new BufferMemory({
  returnMessages: true,
  memoryKey: "chat_history",
});

// Create a chat prompt template with memory
const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", `You are a JIRA ticket assistant. 
        
    If the user is trying to create a JIRA ticket, use the createJiraTicket function.
    Be sure to extract all necessary information from the user's query.
    
    When generating ticket details:
    - Extract as much information as possible from the user's message
    - Generate appropriate descriptions, issue types, priorities, and story points based on industry best practices
    - Use your knowledge of software development to create detailed and helpful ticket information
    
    In response give the ticket number back, for example: ${process.env.JIRA_URL}/browse/ticketnumber
    
    Be helpful, concise, and professional in all responses.`],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

// Configure the model to use the tool
const modelWithTools = chatModel.bind({
  functions: [convertToOpenAIFunction(createJiraTicketTool)]
});

// Use LLMChain which handles memory integration more simply
const chain = new LLMChain({
  llm: modelWithTools,
  prompt: chatPrompt,
  memory: memory,
  verbose: true,
});

// Routes
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    console.log("Received prompt:", prompt);
    
    // Run the chain - much simpler with LLMChain
    const response = await chain.call({ input: prompt });
    console.log("response:", prompt);
    
    // No need to manually save context, LLMChain handles it
    const outputKey = "text"; // Ensure we are fetching the correct key
res.json({ message: response[outputKey] });


  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});