import { z } from "zod";

export const jiraTicketSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title should be at most 100 characters long"),
    description: z.string().min(1, "Description is required").max(2000, "Description should be at most 1000 characters long"),
    project: z.string().min(1, "Project is required"),
    issueType: z.string().refine(value => ['Story', 'Bug', 'Task', 'Sub-task'].includes(value), {
        message: "Issue type must be one of 'Story', 'Bug', 'Task', or 'Sub-task'",
    }),
    priority: z.string().refine(value => ['High', 'Medium', 'Low'].includes(value), {
        message: "Priority must be 'High', 'Medium', or 'Low'",
    }),
    storyPoints: z.number().int().positive().max(13, "Story points must be a value between 1 and 13"),
    parentKey: z.string().optional(),
});

export const updateTicketSchema = z.object({
    ticketId: z.string().describe("The Jira ticket ID to update, pick the last ticket number that you created or updated"),
    status: z.string().optional().refine(value => value === undefined || ['In Progress', 'To Do', 'On Live', 'In Code Review', 'In Stage'].includes(value), {
        message: "Status must be one of 'In Progress', 'To Do', 'On Live', or 'In Code Review', 'In Stage'",
    }).describe("New status for the ticket"),
    title: z.string().optional().describe('new ticket title'),
    summary: z.string().optional().describe("New summary for the ticket"),
    priority: z.string().refine(value => ['High', 'Medium', 'Low'].includes(value), {
        message: "Priority must be 'High', 'Medium', or 'Low'",
    }).describe('new priority for the ticket'),
    description: z.string().optional().describe("New description for the ticket"),
    storyPoints: z.string().optional().describe("New story point for the ticket"),
    assignee: z.string().optional().describe("Username of the person to assign the ticket to")
});
