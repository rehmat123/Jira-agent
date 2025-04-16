import { DynamicStructuredTool } from "@langchain/core/tools";
import {
    jiraTicketSchema,
    updateTicketSchema,
    timeTrackingSchema,
    sprintTicketsSchema,
    timeLogSummarySchema,
    userSprintTicketsSchema
} from "../../schemas/jira.schema";
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

export const jiraTimeTrackingTool = new DynamicStructuredTool({
    name: "logTimeToJiraTicket",
    description: "Log time spent working on a Jira ticket",
    schema: timeTrackingSchema,
    func: async (input: z.infer<typeof timeTrackingSchema>) => {
        const result = await jiraTicket.addWorklog(
            input.ticketId,
            input.timeSpentSeconds,
            input.comment
        );

        if (!result) {
            return 'Failed to log time to the ticket';
        }

        return result;
    },
});

export const jiraSprintTicketsTool = new DynamicStructuredTool({
    name: "listSprintTickets",
    description: "List all tickets in the current active sprint",
    schema: sprintTicketsSchema,
    func: async (input: z.infer<typeof sprintTicketsSchema>) => {
        const tickets = await jiraTicket.getSprintTickets(input.projectKey);

        if (!tickets) {
            return 'No active sprint found or error fetching tickets';
        }

        const ticketList = tickets.map((ticket) => ({
            key: ticket.key,
            summary: ticket.fields.summary,
            status: ticket.fields.status.name,
            assignee: ticket.fields.assignee?.displayName || 'Unassigned',
            timeTracking: ticket.fields.timetracking?.timeSpent || 'No time logged'
        }));

        return JSON.stringify(ticketList, null, 2);
    },
});

export const jiraTimeLogSummaryTool = new DynamicStructuredTool({
    name: "getDailyTimeLogSummary",
    description: "Get a summary of time logged for a specific date (defaults to today)",
    schema: timeLogSummarySchema,
    func: async (input: z.infer<typeof timeLogSummarySchema>) => {
        const summary = await jiraTicket.getDailyTimeLog(input.date);

        if (!summary) {
            return 'Failed to fetch time log summary';
        }

        return JSON.stringify(summary, null, 2);
    },
});

export const jiraUserSprintTicketsTool = new DynamicStructuredTool({
    name: "listUserSprintTickets",
    description: "List all tickets assigned to a current user in the current active sprint",
    schema: userSprintTicketsSchema,
    func: async (input: z.infer<typeof userSprintTicketsSchema>) => {
        const tickets = await jiraTicket.getUserSprintTickets(input.projectKey, input.assignee);

        if (!tickets) {
            return 'No active sprint found or error fetching tickets';
        }

        const ticketList = tickets.map((ticket) => ({
            key: ticket.key,
            summary: ticket.fields.summary,
            status: ticket.fields.status.name,
            assignee: ticket.fields.assignee?.displayName || 'Unassigned',
            timeTracking: ticket.fields.timetracking?.timeSpent || 'No time logged'
        }));

        return JSON.stringify(ticketList, null, 2);
    },
});
