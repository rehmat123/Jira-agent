import { DynamicStructuredTool } from "@langchain/core/tools";
import { jiraTicketSchema, updateTicketSchema } from "../../schemas/jira.schema";
import { z } from "zod";
import { JiraTicket, TicketUpdateDetails } from "./jiraTicket";
import dotenv from 'dotenv';

dotenv.config();

const jiraTicket = new JiraTicket(
    process.env.JIRA_URL!,
    process.env.JIRA_USERNAME!,
    process.env.JIRA_API_TOKEN!,
    process.env.JIRA_ASSIGNEE_ACCOUNT_ID!,
    process.env.OPENAI_API_KEY!
);

export const jiraTicketUpdateTool = new DynamicStructuredTool({
    name: "updateJiraTicket",
    description: "Updates an existing Jira ticket with new information",
    schema: updateTicketSchema,
    func: async (input: z.infer<typeof updateTicketSchema>) => {
        // Simulate Jira ticket creation (replace with actual API call)
        const ticketDetails: TicketUpdateDetails = {
            ticketId: input.ticketId,
            summary: input.title,
            description: input.description,
            priority: input.priority,
            storyPoints: input.storyPoints ? parseFloat(input.storyPoints) : undefined,
            status: input.status,
        };
        const result = await jiraTicket.updateJiraTicket(
            ticketDetails
        );

        if (!result) {
            return 'ticket is not updated. something went wrong';
        }

        return `Ticket Updated with details: ${result}`;
    },
});

export const jiraTicketCreatorTool = new DynamicStructuredTool({
    name: "createJiraTicket",
    description: "Create a Jira ticket with the provided details",
    schema: jiraTicketSchema,
    func: async (input: z.infer<typeof jiraTicketSchema>) => {
        const ticketDetails = {
            summary: input.title,
            description: input.description,
            project: input.project,
            issueType: input.issueType,
            priority: input.priority,
            storyPoints: input.storyPoints,
            parentKey: input.parentKey,
        };
        const result = await jiraTicket.createJiraTicket(
            ticketDetails
        );

        if (!result) {
            return 'ticket is not created. something went wrong';
        }

        if (typeof result === 'string') {
            return `Ticket was not created ${result}`;
        }
        return `Ticket created with ticket id ${result.key}`;
    },
});
