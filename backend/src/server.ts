// server.ts - Main Express backend file with AI function calling
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { JiraTicketCreator, TicketDetails } from './jiraTicketCreator';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import {tools} from './tools';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});


const jiraTicketCreator = new JiraTicketCreator(
  process.env.JIRA_URL!,
  process.env.JIRA_USERNAME!,
  process.env.JIRA_API_TOKEN!,
  process.env.JIRA_ASSIGNEE_ACCOUNT_ID!,
  process.env.OPENAI_API_KEY!
);


export const processToolCalls = async (toolCalls: any[]) => {
  const results = [];

  for (const toolCall of toolCalls) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    let result;
    if (name === "createJiraTicket") {

      const ticketDetails: TicketDetails = {
        summary: parsedArgs.title,
        description: parsedArgs.description,
        project: parsedArgs.project,
        issueType: parsedArgs.issueType,
        priority: parsedArgs.priority,
        storyPoints: parsedArgs.storyPoints,
        parentKey: parsedArgs.parentKey
      };
      result = await jiraTicketCreator.createJiraTicket(
        ticketDetails
      );
    }
    results.push({ tool_call_id: toolCall.id, content: result });
  }

  return results;
};


// Routes
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    let chatHistory: ChatCompletionMessageParam[] = [];

    chatHistory.push({
      role: "user",
      content: prompt,
    });

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are an intelligent JIRA ticket creation assistant designed to help users efficiently generate high-quality, actionable tickets. Your primary goal is to transform user requests into well-structured, clear, and informative JIRA tickets that facilitate effective team communication and project management.
        Ticket Creation Guidelines

        1. Ticket Title
          Create a concise, descriptive title that clearly communicates the core issue or task
          Use active language and be specific
          Aim for 5-10 words that capture the essence of the ticket
          Avoid vague or generic titles

        2. Ticket Description
          Construct a comprehensive description that includes:

          Problem Statement: Clearly define the specific issue or objective
          Acceptance Criteria: Outline measurable conditions that must be met to consider the ticket complete
          Steps to Reproduce (for bugs): Provide a detailed, step-by-step process to replicate the issue
          Impact: Briefly describe the potential consequences if the ticket is not addressed
          Testing: Include any relevant testing like unit , functional and e2e test or quality assurance requirements only if its a code change , if its already a testing ticket dont add it.

        3. Issue Type Selection
          Determine the most appropriate issue type based on the following criteria:

          Story: A user-facing feature or enhancement that provides business value
          Bug: A defect or unexpected behavior in the system that needs correction
          Task: A specific piece of work that doesn't directly relate to a feature or bug
          Sub-task: A smaller, more granular piece of work under a parent ticket

        4. Priority Determination
          Assess priority using the following framework:

          High: Critical issues blocking work, security vulnerabilities, or significant user-impacting problems
          Medium: Important improvements or bugs that affect functionality but have temporary workarounds
          Low: Minor enhancements, cosmetic changes, or non-urgent improvements

        5. Story Points Estimation
          Assign story points considering:

          Complexity of the work
          Expected time to complete
          Technical challenges
          Skill level required
          Standard Fibonacci sequence: 1, 2, 3, 5, 8, 13

        6. Additional Considerations

          If a parent ticket is provided, accurately link the new ticket as a sub-task
          Ensure all environmental or contextual details are included
          Use clear, professional language
          Avoid technical jargon unless necessary

        Communication Principles

          Be precise and actionable
          Provide enough detail for team members to understand the ticket's purpose
          Maintain a professional and constructive tone
          Focus on solving problems and driving project progress

          Final Output
          Upon ticket creation, provide:

          Ticket summary
          Direct link to the created JIRA ticket in the format: ${process.env.JIRA_URL}/browse/PROJECT-123
          Brief explanation of why specific details were chosen`
      },
      ...chatHistory,
    ];

    // Let the AI model determine the intent and handle accordingly
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      tools,
    });
    messages.push(completion.choices[0].message);
    const toolCalls: any = completion.choices[0].message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {

      // Process tool calls
      const toolResults = await processToolCalls(toolCalls);

      //  Update messages with tool results
      const updatedMessages = messages.concat(
        toolResults.map((result) => ({
          role: "tool",
          tool_call_id: result.tool_call_id,
          content: JSON.stringify(result.content),
        }))
      );

      updatedMessages.push({
        role: "system",
        content:
          "You have received all the required tool responses. Now summarize the final answer for the user.",
      });

      // Get the final response
      const completion2 = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: updatedMessages,
        tools,
      });

      messages.push(completion2.choices[0].message);

      const finalMessage = completion2.choices[0].message?.content;
      if (!finalMessage) {
        console.log("Warning: OpenAI returned a null content message.");
        res.status(500).json({ message: "Unexpected response from OpenAI." });
        return;
      }
      res.json({ message: finalMessage });
    } else {
      // Fallback for when no function is called
      const completion2 = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        tools,
        store: false,
      });

      messages.push(completion2.choices[0].message);
      res.json({ message: completion2.choices[0].message.content });
    }


  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
