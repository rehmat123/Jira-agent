import axios from 'axios';
import { OpenAI } from 'openai';

export interface TicketDetails {
  project: string;
  issueType: string;
  summary: string;
  description: string;
  priority: string;
  storyPoints?: number;
  parentKey?: string;
  sprintId?: string;
}

export interface TicketUpdateDetails {
  ticketId: string;
  summary?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  storyPoints?: number;
}

export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: 'scrum' | 'kanban';
  location: JiraLocation;
  isPrivate: boolean;
}

interface JiraResponse {
  key: string;
}

export interface JiraLocation {
  projectId: number;
  displayName: string;
  projectName: string;
  projectKey: string;
  projectTypeKey: string;
  avatarURI: string;
  name: string;
}

export interface JiraBoardResponse {
  id: number;
  values: JiraBoard[];
}

interface JiraWorklogResponse {
    worklogs: Array<{
        timeSpentSeconds: number;
        timeSpent: string;
        started: string;
        comment?: string;
    }>;
}

interface JiraSearchResponse {
    issues: Array<{
        key: string;
        fields: {
            summary: string;
        };
    }>;
}

interface JiraSprintTicketsResponse {
    issues: Array<{
        key: string;
        fields: {
            summary: string;
            status: {
                name: string;
            };
            assignee?: {
                displayName: string;
            };
            timetracking?: {
                timeSpent: string;
            };
        };
    }>;
}

export class JiraTicket {
  private jiraUrl: string;
  private auth: { username: string; password: string };
  private assigneeAccountId: string;
  private headers: Record<string, string>;
  private openai: OpenAI;

  constructor(
    jiraUrl: string,
    username: string,
    apiToken: string,
    assigneeAccountId: string,
    openaiApiKey: string
  ) {
    this.jiraUrl = jiraUrl;
    this.auth = { username, password: apiToken };
    this.assigneeAccountId = assigneeAccountId;
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }


  async getCurrentActiveSprint(projectKey: string): Promise<number | null> {
    try {
      // First, find the board associated with the project
      const boardResponse = await axios.get<JiraBoardResponse>(`${this.jiraUrl}/rest/agile/1.0/board`, {
        headers: this.headers,
        auth: this.auth,
        params: {
          projectKeyOrId: projectKey
        }
      });

      // Find the first board that matches the project key exactly
      const board = boardResponse.data.values.find(
        (b: any) => b.location?.projectKey === projectKey
      );

      if (!board) {
        return null;
      }
      const boardId = board.id;
      if (!boardId) {
        return null;
      }

      const sprintsResponse = await axios.get(`${this.jiraUrl}/rest/agile/1.0/board/${boardId}/sprint`, {
        headers: this.headers,
        auth: this.auth,
        params: {
          state: 'active'
        }
      });

      // Return the ID of the active sprint
      return (sprintsResponse as any).data.values[0]?.id || null;

    } catch (error) {
      console.error('Error fetching current sprint:', error);
      return null;
    }
  }


  async createJiraTicket(details: TicketDetails): Promise<string | null | {
    key: string
  }> {

    // Find the active Sprint ID
    const sprintId = await this.getCurrentActiveSprint(details.project);

    try {
      const endpoint = `${this.jiraUrl}/rest/api/3/issue`;
      const payload = {
        fields: {
          project: { key: details.project },
          summary: details.summary,
          description: this.markdownToAtlassianDoc(details.description),
          issuetype: { name: details.issueType },
          priority: { name: details.priority },
          assignee: { id: this.assigneeAccountId },
          ...(process.env.JIRA_STORY_POINTS_FIELD_ID && { [process.env.JIRA_STORY_POINTS_FIELD_ID]: details.storyPoints }),
          ...(details.parentKey && { parent: { key: details.parentKey } }),
        },
      };


      const response = await axios.post<JiraResponse>(endpoint, payload, { headers: this.headers, auth: this.auth });

      if (response.status !== 201) {
        return (`Error creating JIRA ticket:, ${response.data}`);
      }

      if (!sprintId) {
        return 'Issue created, but no active sprint found to assign it to.';
      }

      await axios.post(`${this.jiraUrl}/rest/agile/1.0/sprint/${sprintId}/issue`,
        {
          issues: [response.data.key]
        },
        {
          headers: this.headers,
          auth: this.auth
        }
      );
      return response.data;

    } catch (error) {
      console.error('Error creating JIRA ticket:', error);
      return null;
    }
  }



  // Add this method to your JiraTicket class
  async updateJiraTicket(details: TicketUpdateDetails): Promise<string | null> {
    try {
      const endpoint = `${this.jiraUrl}/rest/api/3/issue/${details.ticketId}`;
      const updateFields: any = {};

      if (details.summary) {
        updateFields.summary = details.summary;
      }
      if (details.description) {
        updateFields.description = this.markdownToAtlassianDoc(details.description);
      }
      if (details.priority) {
        updateFields.priority = { name: details.priority };
      }
      if (details.assignee) {
        updateFields.assignee = { id: details.assignee };
      }
      if (details.storyPoints && process.env.JIRA_STORY_POINTS_FIELD_ID) {
        updateFields[process.env.JIRA_STORY_POINTS_FIELD_ID] = details.storyPoints;
      }

      // Update the issue fields
      if (Object.keys(updateFields).length > 0) {
        await axios.put(
          endpoint,
          { fields: updateFields },
          { headers: this.headers, auth: this.auth }
        );
      }

      // Handle status update if provided
      if (details.status) {
        const transitionsEndpoint = `${endpoint}/transitions`;
        const transitions = await axios.get<{ transitions: { id: string; name: string }[] }>(transitionsEndpoint, {
          headers: this.headers,
          auth: this.auth
        });
        console.log(transitions.data.transitions.map((data) => data));

        const targetTransition = transitions.data.transitions.find(
          (t: any) => t.to.name.toLowerCase() === details.status?.toLowerCase()
        );
        if (targetTransition) {
          await axios.post(
            transitionsEndpoint,
            {
              transition: { id: targetTransition.id }
            },
            { headers: this.headers, auth: this.auth }
          );
        } else {
          throw new Error(`Status transition to '${details.status}' not available`);
        }
      }

      return `Successfully updated ticket ${details.ticketId}`;
    } catch (error) {
      console.error('Error updating JIRA ticket:', error);

      return null;
    }
  }

  private markdownToAtlassianDoc(markdown: string) {
    const lines = markdown.split('\n');
    const content: any[] = [];

    lines.forEach(line => {
      if (line.trim() === '') return;

      if (line.startsWith('# ')) {
        content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: line.substring(2) }] });
      } else if (line.startsWith('- [ ] ')) {
        content.push({ type: 'taskList', content: [{ type: 'taskItem', attrs: { state: 'TODO' }, content: [{ type: 'text', text: line.substring(6) }] }] });
      } else {
        const formattedContent: any[] = [];
        let match;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIndex = 0;

        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            formattedContent.push({ type: 'text', text: line.substring(lastIndex, match.index) });
          }
          formattedContent.push({ type: 'text', marks: [{ type: 'strong' }], text: match[1] });
          lastIndex = match.index + match[0].length;
        }

        if (lastIndex < line.length) {
          formattedContent.push({ type: 'text', text: line.substring(lastIndex) });
        }

        content.push({ type: 'paragraph', content: formattedContent });
      }
    });

    return { type: 'doc', version: 1, content };
  }

  async addWorklog(ticketId: string, timeSpentSeconds: number, comment?: string): Promise<string | null> {
    try {
      const endpoint = `${this.jiraUrl}/rest/api/3/issue/${ticketId}/worklog`;
      const payload = {
        timeSpentSeconds,
        comment: comment ? {
          type: "doc",
          version: 1,
          content: [{
            type: "paragraph",
            content: [{
              type: "text",
              text: comment
            }]
          }]
        } : undefined
      };

      const response = await axios.post(endpoint, payload, {
        headers: this.headers,
        auth: this.auth
      });

      if (response.status === 201) {
        return `Successfully logged ${timeSpentSeconds / 3600} hours to ${ticketId}`;
      }
      return null;
    } catch (error) {
      console.error('Error logging work:', error);
      return null;
    }
  }

  async getSprintTickets(projectKey: string): Promise<any[] | null> {
    try {
      const sprintId = await this.getCurrentActiveSprint(projectKey);
      if (!sprintId) {
        return null;
      }

      const response = await axios.get<JiraSprintTicketsResponse>(
        `${this.jiraUrl}/rest/agile/1.0/sprint/${sprintId}/issue`,
        {
          headers: this.headers,
          auth: this.auth,
          params: {
            fields: 'summary,status,assignee,timetracking'
          }
        }
      );

      return response.data.issues;
    } catch (error) {
      console.error('Error fetching sprint tickets:', error);
      return null;
    }
  }

  async getDailyTimeLog(date?: string): Promise<any | null> {
    try {
      const searchDate = date || new Date().toISOString().split('T')[0];
      const jql = `worklogDate = "${searchDate}" AND worklogAuthor = currentUser()`;
      
      const response = await axios.post<JiraSearchResponse>(
        `${this.jiraUrl}/rest/api/3/search`,
        {
          jql,
          fields: ['summary', 'worklog']
        },
        {
          headers: this.headers,
          auth: this.auth
        }
      );

      const issues = response.data.issues;
      let totalSeconds = 0;
      const worklogEntries: any[] = [];

      for (const issue of issues) {
        const worklogResponse = await axios.get<JiraWorklogResponse>(
          `${this.jiraUrl}/rest/api/3/issue/${issue.key}/worklog`,
          {
            headers: this.headers,
            auth: this.auth
          }
        );

        const todaysLogs = worklogResponse.data.worklogs.filter((log) => 
          log.started.startsWith(searchDate)
        );

        for (const log of todaysLogs) {
          totalSeconds += log.timeSpentSeconds;
          worklogEntries.push({
            issueKey: issue.key,
            issueSummary: issue.fields.summary,
            timeSpent: log.timeSpent,
            comment: log.comment
          });
        }
      }

      return {
        date: searchDate,
        totalHours: (totalSeconds / 3600).toFixed(2),
        entries: worklogEntries
      };
    } catch (error) {
      console.error('Error fetching daily time log:', error);
      return null;
    }
  }

  async getUserSprintTickets(projectKey: string, assignee?: string): Promise<any[] | null> {
    try {
      const sprintId = await this.getCurrentActiveSprint(projectKey);
      if (!sprintId) {
        return null;
      }

      // If assignee is not provided, use the current user's account ID
      const assigneeId = assignee || this.assigneeAccountId;

      const response = await axios.get<JiraSprintTicketsResponse>(
        `${this.jiraUrl}/rest/agile/1.0/sprint/${sprintId}/issue`,
        {
          headers: this.headers,
          auth: this.auth,
          params: {
            fields: 'summary,status,assignee,timetracking',
            jql: `assignee = "${assigneeId}"`
          }
        }
      );

      return response.data.issues;
    } catch (error) {
      console.error('Error fetching user sprint tickets:', error);
      return null;
    }
  }
}
