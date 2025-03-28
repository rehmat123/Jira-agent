import OpenAI from "openai";

// create as many tools as you need
// each tool should have a unique name
export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "createJiraTicket",
      description: "Create JIRA Ticket based on user input",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title or summary of the JIRA ticket"
          },
          description: {
            type: "string",
            description: "Detailed description of the ticket"
          },
          project: {
            type: "string",
            description: "JIRA project key (e.g., 'PROJ')"
          },
          issueType: {
            type: "string",
            description: "Type of issue (e.g., 'Story', 'Bug', 'Task')"
          },
          priority: {
            type: "string",
            description: "Priority level (e.g., 'High', 'Medium', 'Low')"
          },
          storyPoints: {
            type: "number",
            description: "Estimated story points (1, 2, 3, 5, 8, 13)"
          },
          parentKey: {
            type: "string",
            description: "Optional parent ticket key"
          }
        },
        required: ["title", "description", "project", "issueType", "priority", "storyPoints"]
      }
    }
  },
];